export type UserRole = 'employee' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export interface Vegetable {
  id: string;
  name: string;
  description: string;
  pricePerKg: number;
  stockKg: number;
  category: string;
  imageUrl: string;
  isAvailable: boolean;
  updatedAt: string;
}

export interface OrderItem {
  vegetableId: string;
  name: string;
  quantityKg: number;
  priceAtOrder: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'ready' | 'picked_up' | 'cancelled';

export interface Order {
  id: string;
  userId: string;
  userName: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  pickupTime?: string;
}
