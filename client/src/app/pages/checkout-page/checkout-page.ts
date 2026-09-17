import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { LucideAngularModule, Lock, CheckCircle2, XCircle, Copy, ArrowLeft } from 'lucide-angular';
import { Navbar } from '../../components/navbar/navbar';
import { Footer } from '../../components/footer/footer';
import { CartService, getDiscountedPrice } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { SettingsService } from '../../services/settings.service';
import { CheckoutService, PayResult, ShippingOption } from '../../services/checkout.service';
import { ToastService } from '../../services/toast.service';
import { ApiError } from '../../services/api-error';
import { Order } from '../../types/order';
import { ProductCategory } from '../../types/product';
import { isValidCpf, normalizeCpf, formatCpf } from '../../utils/cpf';
import { formatCep } from '../../utils/cep';

type CategoryOrAll = ProductCategory | 'todos';
type Step = 'dados' | 'pagamento' | 'aguardando' | 'sucesso' | 'recusado';

const MP_SCRIPT_ID = 'mercadopago-sdk';
const MP_SCRIPT_SRC = 'https://sdk.mercadopago.com/js/v2';

interface ViaCepResponse {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

@Component({
  selector: 'app-checkout-page',
  imports: [LucideAngularModule, Navbar, Footer],
  templateUrl: './checkout-page.html',
})
export class CheckoutPage implements OnInit, OnDestroy {
  private router = inject(Router);
  private titleService = inject(Title);
  private settingsService = inject(SettingsService);
  private checkoutService = inject(CheckoutService);
  private toastService = inject(ToastService);
  cartService = inject(CartService);
  authService = inject(AuthService);

  readonly Lock = Lock;
  readonly CheckCircle2 = CheckCircle2;
  readonly XCircle = XCircle;
  readonly Copy = Copy;
  readonly ArrowLeft = ArrowLeft;
  readonly formatPrice = formatPrice;
  readonly getDiscountedPrice = getDiscountedPrice;

  // navbar precisa desses inputs, mas essa página não filtra produtos
  activeCategory = signal<CategoryOrAll>('todos');
  searchQuery = signal('');

  step = signal<Step>('dados');
  submittingOrder = signal(false);
  order = signal<Order | null>(null);
  payResult = signal<PayResult | null>(null);

  name = signal('');
  email = signal('');
  cpf = signal('');

  cep = signal('');
  street = signal('');
  number = signal('');
  complement = signal('');
  neighborhood = signal('');
  city = signal('');
  state = signal('');
  cepLookupState = signal<'idle' | 'loading' | 'not-found'>('idle');

  shippingOptions = signal<ShippingOption[]>([]);
  shippingLoading = signal(false);
  selectedShippingOptionId = signal<number | null>(null);

  private brickController: { unmount(): void } | null = null;
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  // Antes do pedido ser criado, mostra uma estimativa com base no carrinho; depois,
  // usa os valores reais gravados no pedido (fonte da verdade é o backend).
  readonly cartSubtotal = computed(() => this.cartService.totalPrice());
  readonly selectedShippingOption = computed(() =>
    this.shippingOptions().find((opt) => opt.id === this.selectedShippingOptionId())
  );
  readonly shippingEstimate = computed(() => {
    const chosen = this.selectedShippingOption();
    if (chosen) return chosen.price;
    const settings = this.settingsService.settings();
    return this.cartSubtotal() >= settings.freeShippingThreshold ? 0 : settings.shippingFee;
  });
  readonly displayShipping = computed(() => this.order()?.shippingCost ?? this.shippingEstimate());
  readonly displaySubtotal = computed(() => {
    const order = this.order();
    return order ? order.total - order.shippingCost : this.cartSubtotal();
  });
  readonly displayTotal = computed(() => this.order()?.total ?? this.cartSubtotal() + this.shippingEstimate());

  constructor() {
    this.titleService.setTitle(`Checkout | ${this.settingsService.settings().storeName}`);
  }

  ngOnInit(): void {
    if (this.cartService.items().length === 0) {
      this.router.navigateByUrl('/');
      return;
    }
    const user = this.authService.user();
    if (user) {
      this.name.set(user.name);
      this.email.set(user.email);
      this.cpf.set(formatCpf(user.cpf));
      this.cep.set(formatCep(user.cep));
      this.street.set(user.street);
      this.number.set(user.number);
      this.complement.set(user.complement ?? '');
      this.neighborhood.set(user.neighborhood);
      this.city.set(user.city);
      this.state.set(user.state);
      if (user.cep) this.fetchShippingOptions(user.cep.replace(/\D/g, ''));
    }
  }

  ngOnDestroy(): void {
    this.brickController?.unmount();
    if (this.pollHandle) clearInterval(this.pollHandle);
  }

  onCpfInput(value: string): void {
    this.cpf.set(formatCpf(value));
  }

  onCepInput(value: string): void {
    const formatted = formatCep(value);
    this.cep.set(formatted);
    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 8) {
      this.lookupCep(digits);
      this.fetchShippingOptions(digits);
    } else {
      this.shippingOptions.set([]);
      this.selectedShippingOptionId.set(null);
    }
  }

  private async lookupCep(digits: string): Promise<void> {
    this.cepLookupState.set('loading');
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data: ViaCepResponse = await res.json();
      if (data.erro) {
        this.cepLookupState.set('not-found');
        return;
      }
      this.street.set(data.logradouro ?? '');
      this.neighborhood.set(data.bairro ?? '');
      this.city.set(data.localidade ?? '');
      this.state.set(data.uf ?? '');
      this.cepLookupState.set('idle');
    } catch {
      this.cepLookupState.set('not-found');
    }
  }

  private async fetchShippingOptions(digits: string): Promise<void> {
    this.shippingLoading.set(true);
    try {
      const result = await this.checkoutService.calculateShipping(
        digits,
        this.cartService.items().map((item) => ({ productId: item.product.id, quantity: item.quantity }))
      );
      this.shippingOptions.set(result.options);
      this.selectedShippingOptionId.set(result.options[0]?.id ?? null);
    } catch {
      this.shippingOptions.set([]);
      this.selectedShippingOptionId.set(null);
    } finally {
      this.shippingLoading.set(false);
    }
  }

  selectShippingOption(id: number): void {
    this.selectedShippingOptionId.set(id);
  }

  handleCategoryChange(): void {
    this.router.navigateByUrl('/');
  }

  async handleDadosSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.submittingOrder()) return;

    const name = this.name().trim();
    const email = this.email().trim();
    const cpf = normalizeCpf(this.cpf());
    const cepDigits = this.cep().replace(/\D/g, '');

    if (!name) {
      this.toastService.showToast('Informe seu nome completo.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.toastService.showToast('Informe um e-mail válido.');
      return;
    }
    if (!isValidCpf(cpf)) {
      this.toastService.showToast('Informe um CPF válido.');
      return;
    }
    if (
      cepDigits.length !== 8 ||
      !this.street().trim() ||
      !this.number().trim() ||
      !this.neighborhood().trim() ||
      !this.city().trim() ||
      !this.state().trim()
    ) {
      this.toastService.showToast('Preencha o endereço de entrega completo.');
      return;
    }
    if (this.shippingOptions().length === 0 || this.selectedShippingOptionId() === null) {
      this.toastService.showToast('Escolha uma opção de frete.');
      return;
    }

    this.submittingOrder.set(true);
    try {
      const order = await this.checkoutService.createOrder({
        customerName: name,
        customerContact: email,
        items: this.cartService.items().map((item) => ({
          productId: item.product.id,
          size: item.selectedSize,
          quantity: item.quantity,
        })),
        shippingAddress: {
          cep: cepDigits,
          street: this.street().trim(),
          number: this.number().trim(),
          complement: this.complement().trim() || undefined,
          neighborhood: this.neighborhood().trim(),
          city: this.city().trim(),
          state: this.state().trim(),
        },
        shippingOptionId: this.selectedShippingOptionId() ?? undefined,
      });
      this.order.set(order);
      this.step.set('pagamento');
      setTimeout(() => this.renderPaymentBrick(), 0);
    } catch (err) {
      this.toastService.showToast(
        'Não foi possível iniciar o pedido',
        err instanceof ApiError ? err.message : undefined
      );
    } finally {
      this.submittingOrder.set(false);
    }
  }

  private loadMpScript(): Promise<void> {
    if (window.MercadoPago) return Promise.resolve();
    const existing = document.getElementById(MP_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      return new Promise((resolve) => existing.addEventListener('load', () => resolve()));
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = MP_SCRIPT_ID;
      script.src = MP_SCRIPT_SRC;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Falha ao carregar o Mercado Pago.'));
      document.head.appendChild(script);
    });
  }

  private async renderPaymentBrick(): Promise<void> {
    const order = this.order();
    if (!order) return;

    try {
      await this.loadMpScript();
      const { publicKey } = await this.checkoutService.getPublicKey();
      const mp = new window.MercadoPago!(publicKey, { locale: 'pt-BR' });

      this.brickController = await mp.bricks().create('payment', 'payment-brick-container', {
        initialization: {
          amount: order.total,
          payer: { email: this.email() },
        },
        customization: {
          paymentMethods: {
            creditCard: 'all',
            debitCard: 'all',
            bankTransfer: 'all',
            maxInstallments: 12,
          },
        },
        callbacks: {
          onReady: () => {},
          onSubmit: ({ selectedPaymentMethod, formData }: { selectedPaymentMethod: string; formData: Record<string, unknown> }) =>
            this.handlePaymentSubmit(selectedPaymentMethod, formData),
          onError: (error: unknown) => {
            console.error('Erro no Payment Brick:', error);
          },
        },
      });
    } catch (err) {
      this.toastService.showToast(
        'Não foi possível carregar o pagamento',
        err instanceof Error ? err.message : undefined
      );
    }
  }

  private async handlePaymentSubmit(selectedPaymentMethod: string, formData: Record<string, unknown>): Promise<void> {
    const order = this.order();
    if (!order) return;

    try {
      const payer = (formData['payer'] ?? {}) as {
        email?: string;
        identification?: { type: string; number: string };
      };
      const result = await this.checkoutService.pay({
        orderId: order.id,
        selectedPaymentMethod,
        token: formData['token'] as string | undefined,
        payment_method_id: formData['payment_method_id'] as string,
        issuer_id: formData['issuer_id'] as string | undefined,
        installments: formData['installments'] as number | undefined,
        payer: {
          email: payer.email ?? this.email(),
          identification: payer.identification,
        },
      });
      this.payResult.set(result);
      this.handlePayResult(result);
    } catch (err) {
      this.toastService.showToast(
        'Não foi possível processar o pagamento',
        err instanceof ApiError ? err.message : undefined
      );
    }
  }

  private handlePayResult(result: PayResult): void {
    // Usa orderStatus (vocabulário normalizado nosso: confirmado/cancelado/pendente)
    // em vez do status cru da Mercado Pago, que já mudou de nome uma vez (approved -> processed).
    if (result.orderStatus === 'confirmado') {
      this.cartService.clearCart();
      this.step.set('sucesso');
    } else if (result.orderStatus === 'cancelado') {
      this.step.set('recusado');
    } else {
      // pendente — ex: Pix aguardando pagamento ou boleto emitido
      this.step.set('aguardando');
      this.startPolling(result.orderId);
    }
  }

  private startPolling(orderId: string): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
    this.pollHandle = setInterval(async () => {
      try {
        const status = await this.checkoutService.getOrderStatus(orderId);
        if (status.status === 'confirmado') {
          if (this.pollHandle) clearInterval(this.pollHandle);
          this.cartService.clearCart();
          this.step.set('sucesso');
        } else if (status.status === 'cancelado') {
          if (this.pollHandle) clearInterval(this.pollHandle);
          this.step.set('recusado');
        }
      } catch {
        // tenta de novo no próximo ciclo
      }
    }, 4000);
  }

  copyPixCode(): void {
    const code = this.payResult()?.qrCode;
    if (!code) return;
    navigator.clipboard
      .writeText(code)
      .then(() => this.toastService.showToast('Código Pix copiado!'))
      .catch(() => this.toastService.showToast('Não foi possível copiar o código.'));
  }

  goHome(): void {
    this.router.navigateByUrl('/');
  }

  goToOrders(): void {
    this.router.navigateByUrl('/minha-conta');
  }

  retryPayment(): void {
    this.payResult.set(null);
    this.step.set('pagamento');
    setTimeout(() => this.renderPaymentBrick(), 0);
  }
}
