import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { LucideAngularModule, ChevronLeft, ChevronRight, Truck, RefreshCcw, CreditCard } from 'lucide-angular';
import { HeroSlideService } from '../../services/hero-slide.service';
import { SettingsService } from '../../services/settings.service';
import { STORE_INFO } from '../../data/store-info';

interface DisplaySlide {
  id: string;
  image: string;
  eyebrow: string;
  title: string;
  highlight: string;
  subtitle: string;
  ctaLabel: string;
}

/** Slides de exemplo: aparecem só enquanto o admin não cadastra os próprios banners. */
const FALLBACK_SLIDES: DisplaySlide[] = [
  {
    id: 'fallback-1',
    image: 'placeholders/hero-1.jpg',
    eyebrow: `${STORE_INFO.yearsInBusiness} anos em ${STORE_INFO.city}`,
    title: 'Vista a rua',
    highlight: 'com atitude',
    subtitle: 'Camisas, calças, bermudas e bonés das marcas que a rua usa, com preço de outlet.',
    ctaLabel: 'Ver produtos',
  },
  {
    id: 'fallback-2',
    image: 'placeholders/hero-2.jpg',
    eyebrow: 'Chegou agora',
    title: 'Novidade toda',
    highlight: 'semana',
    subtitle: 'Passe na loja no Centro ou compre pelo site e receba em casa.',
    ctaLabel: 'Ver novidades',
  },
];

const AUTOPLAY_MS = 7000;
const INTRO_MS = 1600;

@Component({
  selector: 'app-hero',
  imports: [LucideAngularModule],
  templateUrl: './hero.html',
})
export class Hero implements OnDestroy {
  private heroSlideService = inject(HeroSlideService);
  private settingsService = inject(SettingsService);

  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly store = STORE_INFO;

  /** Slides cuja imagem falhou ao carregar: usam uma foto reserva em vez de ficar quebrados. */
  private failed = signal<Set<string>>(new Set());

  imageFor(slide: DisplaySlide): string {
    return this.failed().has(slide.id) ? FALLBACK_SLIDES[0].image : slide.image;
  }

  markFailed(id: string): void {
    this.failed.update((prev) => new Set(prev).add(id));
  }

  /** Só a primeira carga é animada; trocar de slide não repete a entrada. */
  intro = signal(true);
  activeIndex = signal(0);
  private timer?: ReturnType<typeof setInterval>;
  private introTimer?: ReturnType<typeof setTimeout>;

  readonly slides = computed<DisplaySlide[]>(() => {
    const own = this.heroSlideService.slides();
    return own.length > 0 ? own : FALLBACK_SLIDES;
  });

  readonly currentIndex = computed(() => Math.min(this.activeIndex(), this.slides().length - 1));
  readonly currentSlide = computed(() => this.slides()[this.currentIndex()]);

  readonly trustItems = computed(() => {
    const { freeShippingThreshold } = this.settingsService.settings();
    const threshold = freeShippingThreshold.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    return [
      { icon: Truck, label: `Frete grátis acima de ${threshold}` },
      { icon: RefreshCcw, label: 'Troca grátis em 30 dias' },
      { icon: CreditCard, label: 'Até 3x sem juros' },
    ];
  });

  constructor() {
    this.timer = setInterval(() => this.next(), AUTOPLAY_MS);
    this.introTimer = setTimeout(() => this.intro.set(false), INTRO_MS);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.introTimer) clearTimeout(this.introTimer);
  }

  next(): void {
    const total = this.slides().length;
    if (total > 1) this.activeIndex.update((i) => (i + 1) % total);
  }

  prev(): void {
    const total = this.slides().length;
    if (total > 1) this.activeIndex.update((i) => (i - 1 + total) % total);
  }

  goTo(index: number): void {
    this.activeIndex.set(index);
  }

  /**
   * Tamanho do título conforme o comprimento do texto, para que slides com
   * frases curtas e longas ocupem sempre o mesmo espaço (sem o hero "pular").
   */
  titleSize(slide: DisplaySlide): string {
    const length = `${slide.title} ${slide.highlight}`.trim().length;
    if (length <= 20) return 'text-[clamp(3.2rem,8.5vw,7.5rem)]';
    if (length <= 36) return 'text-[clamp(2.8rem,6.5vw,5.5rem)]';
    return 'text-[clamp(2.4rem,5vw,4.25rem)]';
  }

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
