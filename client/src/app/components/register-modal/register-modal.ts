import { Component, inject, output, signal } from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { ApiError } from '../../services/api-error';
import { isValidCpf, formatCpf } from '../../utils/cpf';
import { formatCep } from '../../utils/cep';
import { formatPhone } from '../../utils/phone';

interface ViaCepResponse {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

@Component({
  selector: 'app-register-modal',
  imports: [LucideAngularModule],
  templateUrl: './register-modal.html',
})
export class RegisterModal {
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  readonly X = X;

  close = output<void>();

  name = signal('');
  email = signal('');
  password = signal('');
  showPassword = signal(false);
  cpf = signal('');
  phone = signal('');
  cep = signal('');
  street = signal('');
  number = signal('');
  complement = signal('');
  neighborhood = signal('');
  city = signal('');
  state = signal('');

  cepLookupState = signal<'idle' | 'loading' | 'not-found'>('idle');
  error = signal('');
  submitting = signal(false);

  onCpfInput(value: string): void {
    this.cpf.set(formatCpf(value));
  }

  onPhoneInput(value: string): void {
    this.phone.set(formatPhone(value));
  }

  onCepInput(value: string): void {
    const formatted = formatCep(value);
    this.cep.set(formatted);
    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 8) {
      this.lookupCep(digits);
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

  async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.error.set('');

    if (!isValidCpf(this.cpf())) {
      this.error.set('Informe um CPF válido.');
      return;
    }

    this.submitting.set(true);
    try {
      await this.authService.register({
        name: this.name().trim(),
        email: this.email().trim(),
        password: this.password(),
        cpf: this.cpf(),
        phone: this.phone().trim(),
        cep: this.cep(),
        street: this.street().trim(),
        number: this.number().trim(),
        complement: this.complement().trim() || undefined,
        neighborhood: this.neighborhood().trim(),
        city: this.city().trim(),
        state: this.state().trim(),
      });
      this.toastService.showToast('Conta criada', 'Sua conta foi criada com sucesso.');
      this.close.emit();
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Não foi possível criar a conta.');
    } finally {
      this.submitting.set(false);
    }
  }
}
