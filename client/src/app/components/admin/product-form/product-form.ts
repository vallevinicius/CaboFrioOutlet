import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { AppImageDirective } from '../../../directives/app-image.directive';
import { LucideAngularModule, X, Upload, Plus } from 'lucide-angular';
import { Product, ProductCategory, ProductInput } from '../../../types/product';
import { ApiService } from '../../../services/api.service';
import { ToastService } from '../../../services/toast.service';
import { SettingsService } from '../../../services/settings.service';
import { formatPriceFromNumber, formatPriceInput, parsePriceInput } from '../../../utils/price';
import { CHANNEL_OPTIONS, SalesChannel } from '../../../utils/channel';
import { oversizeMessage, uploadErrorMessage } from '../../../utils/upload-error';
import { CategoryService } from '../../../services/category.service';
import { MAX_SIDE_CM, MAX_WEIGHT_KG, PackageMeasures, packageDefaultsFor, parseMeasure } from '../../../utils/package-defaults';


@Component({
  selector: 'app-product-form',
  imports: [AppImageDirective, LucideAngularModule],
  templateUrl: './product-form.html',
})
export class ProductForm implements OnInit {
  private api = inject(ApiService);
  private toastService = inject(ToastService);
  private settingsService = inject(SettingsService);
  private categoryService = inject(CategoryService);

  readonly X = X;
  readonly Upload = Upload;
  readonly Plus = Plus;
  /** Todas as categorias do painel, inclusive ocultas (peça pode ser cadastrada antes de a categoria ir ao ar). */
  categoryOptions = signal<{ label: string; value: ProductCategory }[]>([]);

  product = input.required<Product | null>();
  formSubmit = output<ProductInput>();
  formClose = output<void>();

  readonly isEditing = computed(() => Boolean(this.product()));

  readonly brandOptions = computed(() => {
    const brands = this.settingsService.settings().brands;
    const current = this.brand();
    return current && !brands.includes(current) ? [...brands, current] : brands;
  });

  name = signal('');
  category = signal<ProductCategory>('camisas');
  brand = signal('');
  price = signal('');
  discountPercent = signal('');
  description = signal('');
  isNew = signal(false);
  /** Onde a peça é vendida. Peça nova começa em "ambos" (o padrão do servidor). */
  channel = signal<SalesChannel>('both');
  /** Peso e medidas da embalagem (usados no frete). Texto digitado, com vírgula ou ponto. */
  weightKg = signal('');
  heightCm = signal('');
  widthCm = signal('');
  lengthCm = signal('');
  /** Se o dono já mexeu nas medidas, trocar a categoria não sobrescreve. */
  private measuresTouched = false;
  readonly maxWeightKg = MAX_WEIGHT_KG;
  readonly maxSideCm = MAX_SIDE_CM;
  readonly channelOptions = CHANNEL_OPTIONS;
  sizes = signal<string[]>([]);
  sizeInput = signal('');
  initialStock = signal('10');
  image = signal('');
  extraImages = signal<string[]>([]);
  readonly maxExtraImages = 8;
  uploading = signal(false);
  error = signal('');

  ngOnInit(): void {
    void this.loadCategories();
    const product = this.product();
    if (!product) {
      this.showMeasures(packageDefaultsFor(this.category()));
      return;
    }
    this.name.set(product.name);
    this.category.set(product.category);
    this.brand.set(product.brand ?? '');
    this.price.set(formatPriceFromNumber(product.price));
    this.discountPercent.set(product.discountPercent ? String(product.discountPercent) : '');
    this.description.set(product.description);
    this.isNew.set(product.isNew ?? false);
    this.channel.set(product.channel ?? 'both');
    if (product.weightKg !== undefined) {
      this.measuresTouched = true;
      this.showMeasures({
        weightKg: product.weightKg,
        heightCm: product.heightCm ?? packageDefaultsFor(product.category).heightCm,
        widthCm: product.widthCm ?? packageDefaultsFor(product.category).widthCm,
        lengthCm: product.lengthCm ?? packageDefaultsFor(product.category).lengthCm,
      });
    } else {
      this.showMeasures(packageDefaultsFor(product.category));
    }
    this.sizes.set(product.sizes);
    this.image.set(product.image);
    this.extraImages.set(product.images ?? []);
  }

  private showMeasures(m: PackageMeasures): void {
    const text = (n: number) => String(n).replace('.', ',');
    this.weightKg.set(text(m.weightKg));
    this.heightCm.set(text(m.heightCm));
    this.widthCm.set(text(m.widthCm));
    this.lengthCm.set(text(m.lengthCm));
  }

  private async loadCategories(): Promise<void> {
    try {
      const all = await this.categoryService.listAll();
      this.categoryOptions.set(all.map((c) => ({ value: c.key, label: c.active ? c.name : `${c.name} (oculta)` })));
    } catch {
      // Sem acesso à lista completa: usa as categorias visíveis no site.
      this.categoryOptions.set(this.categoryService.categories().map((c) => ({ value: c.value, label: c.label })));
    }
    // Produto novo: começa na primeira categoria da lista.
    const options = this.categoryOptions();
    if (!this.product() && options.length > 0 && !options.some((o) => o.value === this.category())) {
      this.onCategoryChange(options[0].value);
    }
  }

  onCategoryChange(value: ProductCategory): void {
    this.category.set(value);
    // Sugere as medidas da categoria, a menos que o dono já tenha ajustado.
    if (!this.measuresTouched) this.showMeasures(packageDefaultsFor(value));
  }

  onMeasureInput(field: 'weightKg' | 'heightCm' | 'widthCm' | 'lengthCm', value: string): void {
    this.measuresTouched = true;
    this[field].set(value);
  }

  onPriceInput(value: string): void {
    this.price.set(formatPriceInput(value));
  }

  addSize(): void {
    const value = this.sizeInput().trim().toUpperCase();
    if (!value || this.sizes().includes(value)) {
      this.sizeInput.set('');
      return;
    }
    this.sizes.update((prev) => [...prev, value]);
    this.sizeInput.set('');
  }

  removeSize(value: string): void {
    this.sizes.update((prev) => prev.filter((s) => s !== value));
  }

  onSizeInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addSize();
    }
  }

  async handleFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const tooBig = oversizeMessage(file);
    if (tooBig) {
      this.showUploadError('Foto grande demais', tooBig);
      input.value = '';
      return;
    }
    this.uploading.set(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { url } = await this.api.post<{ url: string }>('/upload', formData);
      this.image.set(url);
    } catch (err) {
      this.showUploadError('Erro ao enviar a foto', uploadErrorMessage(err, file));
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  async handleExtraFilesChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []).slice(0, this.maxExtraImages - this.extraImages().length);
    if (files.length === 0) return;
    this.uploading.set(true);
    try {
      // Uma foto que falha não descarta as que já subiram, e o aviso diz qual foi.
      for (const file of files) {
        const tooBig = oversizeMessage(file);
        if (tooBig) {
          this.showUploadError(`Foto grande demais: "${file.name}"`, tooBig);
          continue;
        }
        try {
          const formData = new FormData();
          formData.append('image', file);
          const { url } = await this.api.post<{ url: string }>('/upload', formData);
          this.extraImages.update((prev) => [...prev, url]);
        } catch (err) {
          this.showUploadError(`Erro ao enviar "${file.name}"`, uploadErrorMessage(err, file));
        }
      }
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  /** Erro de foto fica 10 s na tela: a mensagem explica o que fazer e precisa dar tempo de ler. */
  private showUploadError(title: string, description: string): void {
    this.toastService.showToast(title, description, { durationMs: 10_000 });
  }

  removeExtraImage(index: number): void {
    this.extraImages.update((prev) => prev.filter((_, i) => i !== index));
  }

  handleSubmit(event: Event): void {
    event.preventDefault();
    const priceNum = parsePriceInput(this.price());

    if (!this.name().trim()) {
      this.error.set('Informe o nome do produto.');
      return;
    }
    if (!priceNum || priceNum <= 0) {
      this.error.set('Informe um preço válido.');
      return;
    }
    if (this.sizes().length === 0) {
      this.error.set('Adicione ao menos um tamanho.');
      return;
    }
    if (!this.image()) {
      this.error.set('Adicione uma foto do produto.');
      return;
    }

    const weight = parseMeasure(this.weightKg(), MAX_WEIGHT_KG);
    const height = parseMeasure(this.heightCm(), MAX_SIDE_CM);
    const width = parseMeasure(this.widthCm(), MAX_SIDE_CM);
    const length = parseMeasure(this.lengthCm(), MAX_SIDE_CM);
    if (weight === null) {
      this.error.set(`Informe o peso da embalagem em kg (de 0,01 até ${MAX_WEIGHT_KG}).`);
      return;
    }
    if (height === null || width === null || length === null) {
      this.error.set(`Informe a altura, a largura e o comprimento da embalagem em cm (até ${MAX_SIDE_CM}).`);
      return;
    }

    const discountRaw = this.discountPercent();
    const discountNum = discountRaw ? parseFloat(discountRaw.replace(',', '.')) : undefined;
    const initialStockNum = Math.max(0, parseInt(this.initialStock(), 10) || 0);

    const existingProduct = this.product();
    const stock: Record<string, number> = {};
    this.sizes().forEach((size) => {
      stock[size] = existingProduct?.stock[size] ?? initialStockNum;
    });

    this.formSubmit.emit({
      name: this.name().trim(),
      category: this.category(),
      brand: this.brand().trim() || undefined,
      price: priceNum,
      image: this.image(),
      images: this.extraImages(),
      description: this.description().trim(),
      sizes: this.sizes(),
      stock,
      discountPercent: discountNum && discountNum > 0 ? discountNum : undefined,
      isNew: this.isNew(),
      channel: this.channel(),
      weightKg: weight,
      heightCm: height,
      widthCm: width,
      lengthCm: length,
    });
  }
}
