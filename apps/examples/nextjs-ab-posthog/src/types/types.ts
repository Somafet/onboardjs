export type UserRole =
  | "ecommerce-owner"
  | "product-manager"
  | "marketing-professional"
  | "software-engineer"
  | "other";

export interface PersonaOption {
  id: UserRole;
  title: string;
  description: string;
  icon: string;
}
