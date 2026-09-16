import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { LucideAngularModule, Lock, CheckCircle2, XCircle, Copy, ArrowLeft } from 'lucide-angular';
import { Navbar } from '../../components/navbar/navbar';
import { Footer } from '../../components/footer/footer';
import { CartService, getDiscountedPrice } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { SettingsService } from '../../services/settings.service';
import { CheckoutService, PayResult } from '../../services/checkout.service';
import { ToastService } from '../../services/toast.service';
import { ApiError } from '../../services/api-error';
import { Order } from '../../types/order';
import { ProductCategory } from '../../types/product';
import { isValidCpf, normalizeCpf, formatCpf } from '../../utils/cpf';

type CategoryOrAll = ProductCategory | 'todos';
type Step = 'dados' | 'pagamento' | 'aguardando' | 'sucesso' | 'recusado';

const MP_SCRIPT_ID = 'mercadopago-sdk';
const MP_SCRIPT_SRC = 'https://sdk.mercadopago.com/js/v2';

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

  private brickController: { unmount(): void } | null = null;
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.titleService.setTitle(`Checkout — ${this.settingsService.settings().storeName}`);
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
    }
  }

  ngOnDestroy(): void {
    this.brickController?.unmount();
    if (this.pollHandle) clearInterval(this.pollHandle);
  }

  onCpfInput(value: string): void {
    this.cpf.set(formatCpf(value));
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
          onSubmit: ({ formData }: { formData: Record<string, unknown> }) => this.handlePaymentSubmit(formData),
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

  private async handlePaymentSubmit(formData: Record<string, unknown>): Promise<void> {
    const order = this.order();
    if (!order) return;

    try {
      const payer = (formData['payer'] ?? {}) as {
        email?: string;
        identification?: { type: string; number: string };
      };
      const result = await this.checkoutService.pay({
        orderId: order.id,
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
    if (result.status === 'approved') {
      this.cartService.clearCart();
      this.step.set('sucesso');
    } else if (result.status === 'rejected' || result.status === 'cancelled') {
      this.step.set('recusado');
    } else {
      // in_process / pending — ex: Pix aguardando pagamento ou boleto emitido
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
