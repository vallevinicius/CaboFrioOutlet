import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule, X, Upload, Plus } from 'lucide-angular';
import { Product, ProductCategory, ProductInput } from '../../../types/product';
import { ApiService } from '../../../services/api.service';
import { ToastService } from '../../../services/toast.service';
import { ApiError } from '../../../services/api-error';
import { SettingsService } from '../../../services/settings.service';
import { formatPriceFromNumber, formatPriceInput, parsePriceInput } from '../../../utils/price';

const CATEGORY_OPTIONS: { label: string; value: ProductCategory }[] = [
  { label: 'Camisas', value: 'camisas' },
  { label: 'Calças', value: 'calças' },
  { label: 'Bermudas', value: 'bermudas' },
  { label: 'Bonés', value: 'bonés' },
];

@Component({
  selector: 'app-product-form',
  imports: [LucideAngularModule],
  templateUrl: './product-form.html',
})
export class ProductForm implements OnInit {
  private api = inject(ApiService);
  private toastService = inject(ToastService);
  private settingsService = inject(SettingsService);

  readonly X = X;
  readonly Upload = Upload;
  readonly Plus = Plus;
  readonly categoryOptions = CATEGORY_OPTIONS;

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
  sizes = signal<string[]>([]);
  sizeInput = signal('');
  initialStock = signal('10');
  image = signal('');
  uploading = signal(false);
  error = signal('');

  ngOnInit(): void {
    const product = this.product();
    if (!product) return;
    this.name.set(product.name);
    this.category.set(product.category);
    this.brand.set(product.brand ?? '');
    this.price.set(formatPriceFromNumber(product.price));
    this.discountPercent.set(product.discountPercent ? String(product.discountPercent) : '');
    this.description.set(product.description);
    this.isNew.set(product.isNew ?? false);
    this.sizes.set(product.sizes);
    this.image.set(product.image);
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
    this.uploading.set(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { url } = await this.api.post<{ url: string }>('/upload', formData);
      this.image.set(url);
    } catch (err) {
      this.toastService.showToast('Erro ao enviar imagem', err instanceof ApiError ? err.message : undefined);
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
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
      description: this.description().trim(),
      sizes: this.sizes(),
      stock,
      discountPercent: discountNum && discountNum > 0 ? discountNum : undefined,
      isNew: this.isNew(),
    });
  }
}
