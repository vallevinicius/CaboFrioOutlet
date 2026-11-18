import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { CategoryService } from '../services/category.service';

/**
 * Rota /:categoria só casa com categoria ativa. Senão o Angular segue para a próxima rota (404).
 * Espera a primeira carga das categorias para não mandar /jaquetas para o 404 por pressa.
 */
export const categoryExists: CanMatchFn = async (_route, segments) => {
  const service = inject(CategoryService);
  await service.ready();
  return service.bySlug(segments[0]?.path) !== undefined;
};
