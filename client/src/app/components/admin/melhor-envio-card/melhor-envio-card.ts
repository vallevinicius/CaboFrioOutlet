import { Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { LucideAngularModule, CircleCheckBig, Link2, TriangleAlert, Unlink } from 'lucide-angular';
import { ApiService } from '../../../services/api.service';
import { ApiError } from '../../../services/api-error';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { MelhorEnvioStatus, describeConnection, freteNotice } from '../../../utils/melhor-envio';

/** Conexão da loja com a Melhor Envio (frete automático): status, conectar e desconectar. */
@Component({
  selector: 'app-melhor-envio-card',
  imports: [LucideAngularModule],
  templateUrl: './melhor-envio-card.html',
})
export class MelhorEnvioCard implements OnInit {
  /** O pai muda este número depois de salvar as configurações, para o estado ser lido de novo. */
  refresh = input(0);

  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toastService = inject(ToastService);

  readonly CircleCheckBig = CircleCheckBig;
  readonly Link2 = Link2;
  readonly TriangleAlert = TriangleAlert;
  readonly Unlink = Unlink;

  readonly canEdit = computed(() => this.auth.can('configuracoes', 'edit'));
  status = signal<MelhorEnvioStatus | null>(null);
  loading = signal(true);
  busy = signal(false);
  readonly view = computed(() => {
    const status = this.status();
    return status ? describeConnection(status) : null;
  });

  constructor() {
    // Roda na criação e toda vez que o pai muda `refresh`.
    effect(() => {
      this.refresh();
      void this.load();
    });
  }

  ngOnInit(): void {
    // Volta da autorização: /admin?frete=conectado | cancelado | erro.
    const params = new URLSearchParams(window.location.search);
    const notice = freteNotice(params.get('frete'));
    if (notice) {
      this.toastService.showToast(notice.title, notice.description, { variant: notice.title === 'Melhor Envio conectada' ? 'success' : undefined, durationMs: 6000 });
    }
    if (params.has('frete')) {
      params.delete('frete');
      const query = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : ''));
    }
  }

  private async load(): Promise<void> {
    try {
      this.status.set(await this.api.get<MelhorEnvioStatus>('/shipping/melhor-envio/status'));
    } catch {
      this.status.set(null); // sem permissão ou servidor fora do ar: o cartão só não mostra o estado
    } finally {
      this.loading.set(false);
    }
  }

  async connect(): Promise<void> {
    this.busy.set(true);
    try {
      const { url } = await this.api.post<{ url: string }>('/shipping/melhor-envio/connect');
      window.location.href = url; // vai para a Melhor Envio autorizar e volta para o painel
    } catch (err) {
      this.toastService.showToast('Não foi possível iniciar a conexão', err instanceof ApiError ? err.message : undefined);
      this.busy.set(false);
    }
  }

  disconnect(): void {
    this.toastService.showConfirm(
      'Desconectar a Melhor Envio?',
      'O frete volta a usar o valor fixo até você conectar de novo.',
      async () => {
        try {
          await this.api.delete('/shipping/melhor-envio');
          this.toastService.showToast('Melhor Envio desconectada');
          await this.load();
        } catch (err) {
          this.toastService.showToast('Não foi possível desconectar', err instanceof ApiError ? err.message : undefined);
        }
      },
      { confirmLabel: 'Desconectar' },
    );
  }
}
