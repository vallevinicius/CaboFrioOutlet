import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Route, UrlSegment } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { categoryExists } from './category.guard';
import { CategoryService } from '../services/category.service';

const seg = (path: string) => [new UrlSegment(path, {})];
const run = (path: string) => TestBed.runInInjectionContext(() => categoryExists({} as Route, seg(path))) as Promise<boolean>;

describe('categoryExists (rota /:categoria)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(CategoryService);
  });

  it('espera as categorias chegarem e só casa com slug de categoria ativa', async () => {
    const pending = run('jaquetas');
    http.expectOne('/api/categories').flush([
      { id: 'c1', key: 'jaquetas', slug: 'jaquetas', name: 'Jaquetas', intro: '', description: '', image: '', order: 0, active: true, subcategories: [] },
    ]);
    expect(await pending).toBe(true);
    expect(await run('inventada')).toBe(false);
  });

  it('se a API falhar, não casa (cai no 404) em vez de travar a navegação', async () => {
    const pending = run('jaquetas');
    http.expectOne('/api/categories').flush('erro', { status: 500, statusText: 'Erro' });
    expect(await pending).toBe(false);
  });
});
