import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  Timestamp,
  addDoc,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { UserProfile, Vegetable, Order, OrderStatus } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const userService = {
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? (docSnap.data() as UserProfile) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
      return null;
    }
  },

  async createUserProfile(profile: UserProfile): Promise<void> {
    try {
      await setDoc(doc(db, 'users', profile.uid), profile);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${profile.uid}`);
    }
  }
};

export const vegetableService = {
  subscribeToVegetables(callback: (vegetables: Vegetable[]) => void) {
    const q = query(collection(db, 'vegetables'), where('isAvailable', '==', true));
    return onSnapshot(q, (snapshot) => {
      const vegetables = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vegetable));
      callback(vegetables);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'vegetables');
    });
  },

  async addVegetable(vegetable: Omit<Vegetable, 'id'>): Promise<void> {
    try {
      await addDoc(collection(db, 'vegetables'), {
        ...vegetable,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'vegetables');
    }
  },

  async updateVegetable(id: string, updates: Partial<Vegetable>): Promise<void> {
    try {
      await updateDoc(doc(db, 'vegetables', id), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vegetables/${id}`);
    }
  },

  async seedInitialData(): Promise<void> {
    try {
      const snapshot = await getDocs(collection(db, 'vegetables'));
      const batch = writeBatch(db);
      
      const initialData = [
        { name: 'Organic Spinach', description: 'Fresh, nutrient-rich leafy greens grown in the campus greenhouse.', pricePerKg: 40, stockKg: 25, category: 'Leafy', imageUrl: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&q=80&w=800', isAvailable: true },
        { name: 'Red Tomatoes', description: 'Vine-ripened, juicy tomatoes perfect for salads and cooking.', pricePerKg: 30, stockKg: 40, category: 'Fruit', imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=800', isAvailable: true },
        { name: 'Crunchy Carrots', description: 'Sweet and crisp root vegetables harvested daily.', pricePerKg: 60, stockKg: 50, category: 'Root', imageUrl: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&q=80&w=800', isAvailable: true },
        { name: 'Bell Peppers', description: 'Colorful and sweet peppers, rich in Vitamin C.', pricePerKg: 80, stockKg: 15, category: 'Fruit', imageUrl: 'https://img.freepik.com/premium-psd/bell-paper-isolated-transparent-background-psd-file-format_944525-37767.jpg?w=2000', isAvailable: true },
        { name: 'Fresh Broccoli', description: 'High-quality cruciferous vegetable with tight green florets.', pricePerKg: 120, stockKg: 20, category: 'Cruciferous', imageUrl: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&q=80&w=800', isAvailable: true },
        { name: 'Sweet Potatoes', description: 'Nutritious and versatile root vegetables.', pricePerKg: 50, stockKg: 35, category: 'Root', imageUrl: 'https://wallpapers.com/images/hd/assorted-sweet-potato-0rj154ecxgan35ps.jpg', isAvailable: true },
        { name: 'Purple Cabbage', description: 'Vibrant and crunchy cabbage, great for slaws and salads.', pricePerKg: 45, stockKg: 18, category: 'Cruciferous', imageUrl: 'https://static.india.com/wp-content/uploads/2024/02/Purple-Cabbage-7.png', isAvailable: true },
        { name: 'Fresh Ginger', description: 'Zesty and aromatic root, essential for many campus recipes.', pricePerKg: 150, stockKg: 10, category: 'Root', imageUrl: 'https://static.vecteezy.com/system/resources/previews/036/626/912/non_2x/ai-generated-organic-ginger-isolated-on-transparent-background-png.png', isAvailable: true },
        { name: 'Green Peas', description: 'Sweet and tender peas, freshly shelled.', pricePerKg: 90, stockKg: 12, category: 'Legume', imageUrl: 'https://e1.pxfuel.com/desktop-wallpaper/104/108/desktop-wallpaper-green-peas-peas.jpg', isAvailable: true },
        { name: 'Cauliflower', description: 'Fresh white cauliflower heads, perfect for roasting.', pricePerKg: 70, stockKg: 22, category: 'Cruciferous', imageUrl: 'https://cdn.pixabay.com/photo/2024/06/20/09/51/cauliflower-8841682_1280.jpg', isAvailable: true },
        { name: 'Cucumber', description: 'Cool and hydrating cucumbers, perfect for campus lunches.', pricePerKg: 35, stockKg: 30, category: 'Fruit', imageUrl: 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?auto=format&fit=crop&q=80&w=800', isAvailable: true }
      ];

      const existingNames = snapshot.docs.map(doc => doc.data().name);
      
      // Add missing items
      initialData.forEach(item => {
        if (!existingNames.includes(item.name)) {
          const newDocRef = doc(collection(db, 'vegetables'));
          batch.set(newDocRef, { ...item, updatedAt: new Date().toISOString() });
        }
      });

      // Update existing items (to fix images, prices, or availability)
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const match = initialData.find(item => item.name === data.name);
        if (match) {
          batch.update(docSnap.ref, { 
            imageUrl: match.imageUrl, 
            pricePerKg: match.pricePerKg,
            isAvailable: true,
            updatedAt: new Date().toISOString() 
          });
        }
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'vegetables/seed');
    }
  }
};

export const orderService = {
  async createOrder(order: Omit<Order, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'orders'), {
        ...order,
        createdAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
      return '';
    }
  },

  subscribeToUserOrders(userId: string, callback: (orders: Order[]) => void) {
    const q = query(
      collection(db, 'orders'), 
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      callback(orders);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });
  },

  subscribeToAllOrders(callback: (orders: Order[]) => void) {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      callback(orders);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });
  },

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  }
};
