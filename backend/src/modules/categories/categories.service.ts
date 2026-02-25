import { createId } from '../../utils/ids.js';

interface Category {
  id: string;
  title: string;
  description: string;
  answers: string[];
  ownerUserId: string;
  isPublic: boolean;
}

const categories = new Map<string, Category>();

export function saveCategory(input: Omit<Category, 'id'>) {
  const category: Category = { id: createId(), ...input };
  categories.set(category.id, category);
  return category;
}

export function getPublicCategories() {
  return [...categories.values()].filter((category) => category.isPublic);
}

export function getCategoriesByOwner(ownerUserId: string) {
  return [...categories.values()].filter((category) => category.ownerUserId === ownerUserId);
}
