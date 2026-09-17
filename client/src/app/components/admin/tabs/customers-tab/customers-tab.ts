import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { LucideAngularModule, Users, ShieldCheck, UserPlus } from 'lucide-angular';
import { CustomerProfile } from '../../../../types/user';
import { ApiService } from '../../../../services/api.service';
import { ToastService } from '../../../../services/toast.service';
import { ApiError } from '../../../../services/api-error';
import { StatCard } from '../../stat-card/stat-card';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatCpf(cpf: string): string {
  if (cpf.length !== 11) return cpf || 'Não informado';
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

@Component({
  selector: 'app-customers-tab',
  imports: [LucideAngularModule, StatCard],
  templateUrl: './customers-tab.html',
})
export class CustomersTab implements OnInit {
  private api = inject(ApiService);
  private toastService = inject(ToastService);

  readonly Users = Users;
  readonly ShieldCheck = ShieldCheck;
  readonly UserPlus = UserPlus;
  readonly formatDate = formatDate;
  readonly formatCpf = formatCpf;

  customers = signal<CustomerProfile[]>([]);
  loading = signal(true);
  updatingId = signal<string | null>(null);

  readonly stats = computed(() => {
    const customers = this.customers();
    return {
      total: customers.length,
      admins: customers.filter((c) => c.isAdmin).length,
    };
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .get<CustomerProfile[]>('/users')
      .then((data) => this.customers.set(data))
      .catch((err) =>
        this.toastService.showToast('Erro ao carregar clientes', err instanceof ApiError ? err.message : undefined)
      )
      .finally(() => this.loading.set(false));
  }

  async toggleAdmin(customer: CustomerProfile): Promise<void> {
    const nextIsAdmin = !customer.isAdmin;
    this.updatingId.set(customer.id);
    try {
      const updated = await this.api.patch<CustomerProfile>(`/users/${customer.id}/admin`, {
        isAdmin: nextIsAdmin,
      });
      this.customers.update((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      this.toastService.showToast(
        'Erro ao atualizar permissão',
        err instanceof ApiError ? err.message : undefined
      );
    } finally {
      this.updatingId.set(null);
    }
  }
}
