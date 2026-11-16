import { Component, computed, inject, input } from '@angular/core';
import { LucideAngularModule, MessageCircle, Mail } from 'lucide-angular';
import { Order } from '../../../types/order';
import { SettingsService } from '../../../services/settings.service';
import { formatCep } from '../../../utils/cep';
import { formatCpf } from '../../../utils/cpf';
import { formatPhone } from '../../../utils/phone';
import { formatInstallments, formatOrderDate, formatPaymentMethod, formatPaymentStatus } from '../../../utils/order-format';
import { orderWhatsappUrl } from '../../../utils/whatsapp';

/** Dados do cliente, da entrega, do pagamento e do pedido, com o atalho para chamar o cliente no WhatsApp. */
@Component({
  selector: 'app-order-details',
  imports: [LucideAngularModule],
  templateUrl: './order-details.html',
})
export class OrderDetails {
  order = input.required<Order>();

  private settings = inject(SettingsService);

  readonly MessageCircle = MessageCircle;
  readonly Mail = Mail;
  readonly formatDate = formatOrderDate;
  readonly formatPaymentMethod = formatPaymentMethod;
  readonly formatInstallments = formatInstallments;
  readonly formatPaymentStatus = formatPaymentStatus;

  readonly code = computed(() => this.order().id.slice(-6).toUpperCase());

  /** Telefone gravado no pedido; em pedido antigo (sem telefone), o do cadastro. */
  readonly phone = computed(() => this.order().customerPhone || this.order().account?.phone || '');
  readonly phoneDisplay = computed(() => formatPhone(this.phone()));

  readonly cpf = computed(() => {
    const digits = this.order().customerCpf || this.order().account?.cpf || '';
    return digits ? formatCpf(digits) : '';
  });

  readonly whatsappUrl = computed(() =>
    orderWhatsappUrl(this.phone(), this.order().customerName, this.code(), this.settings.settings().storeName),
  );

  readonly hasAddress = computed(() => Boolean(this.order().shippingStreet));
  readonly cep = computed(() => formatCep(this.order().shippingCep ?? ''));
  readonly subtotal = computed(() => this.order().total - (this.order().shippingCost ?? 0));
}
