/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { userService, vegetableService, orderService } from './lib/services';
import { UserProfile, Vegetable, Order, OrderItem, OrderStatus } from './types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ShoppingCart, LogOut, User as UserIcon, Plus, Trash2, CheckCircle2, Clock, Package, Truck, XCircle, Leaf, Search } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [vegetables, setVegetables] = useState<Vegetable[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [activeTab, setActiveTab] = useState('browse');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setUser(firebaseUser);
        if (firebaseUser) {
          let userProfile = await userService.getUserProfile(firebaseUser.uid);
          if (!userProfile) {
            userProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'User',
              role: 'employee',
              createdAt: new Date().toISOString(),
            };
            await userService.createUserProfile(userProfile);
          }
          setProfile(userProfile);
          // Seed initial data if the store is empty
          await vegetableService.seedInitialData();
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const unsubscribe = vegetableService.subscribeToVegetables(setVegetables);
      return () => unsubscribe();
    }
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Successfully logged in!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to login');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    toast.info('Logged out');
  };

  const addToCart = (veg: Vegetable) => {
    setCart((prev: OrderItem[]) => {
      const existing = prev.find((item: OrderItem) => item.vegetableId === veg.id);
      if (existing) {
        return prev.map((item: OrderItem) => 
          item.vegetableId === veg.id 
            ? { ...item, quantityKg: item.quantityKg + 0.5 } 
            : item
        );
      }
      return [...prev, { 
        vegetableId: veg.id, 
        name: veg.name, 
        quantityKg: 0.5, 
        priceAtOrder: veg.pricePerKg 
      }];
    });
    toast.success(`Added ${veg.name} to cart`);
  };

  const removeFromCart = (id: string) => {
    setCart((prev: OrderItem[]) => prev.filter((item: OrderItem) => item.vegetableId !== id));
  };

  const cartTotal = cart.reduce((sum: number, item: OrderItem) => sum + (item.priceAtOrder * item.quantityKg), 0);

  const placeOrder = async () => {
    if (!profile) return;
    const orderData = {
      userId: profile.uid,
      userName: profile.displayName,
      items: cart,
      totalAmount: cartTotal,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    };
    const orderId = await orderService.createOrder(orderData);
    if (orderId) {
      setCart([]);
      toast.success('Order placed successfully!');
      setActiveTab('orders');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Leaf className="w-12 h-12 text-green-600" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-stone-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-2">
            <div className="flex justify-center">
              <div className="p-4 bg-green-100 rounded-full">
                <Leaf className="w-12 h-12 text-green-600" />
              </div>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-stone-900">FreshFarm@Campus</h1>
            <p className="text-stone-600">Fresh university-grown vegetables, delivered to your plate.</p>
          </div>
          <Card className="border-stone-200 shadow-xl">
            <CardHeader>
              <CardTitle>Welcome Back</CardTitle>
              <CardDescription>Sign in with your university account to start shopping.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleLogin} className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg">
                Sign in with Google
              </Button>
            </CardContent>
            <CardFooter className="text-xs text-stone-500 justify-center">
              Exclusive for University Employees & Staff
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    );
  }

  const filteredVegetables = vegetables.filter((v: Vegetable) => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <nav className="sticky top-0 z-50 w-full border-b border-stone-200 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="w-6 h-6 text-green-600" />
            <span className="text-xl font-bold text-stone-900 hidden sm:inline-block">FreshFarm@Campus</span>
          </div>

          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger
                render={
                  <Button variant="outline" size="icon" className="relative">
                    <ShoppingCart className="w-5 h-5" />
                    {cart.length > 0 && (
                      <Badge className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-green-600 min-w-[20px] h-5">
                        {cart.length}
                      </Badge>
                    )}
                  </Button>
                }
              />
              <SheetContent className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Your Cart</SheetTitle>
                  <SheetDescription>Review your fresh picks before checkout.</SheetDescription>
                </SheetHeader>
                <div className="mt-8 space-y-4">
                  {cart.length === 0 ? (
                    <div className="text-center py-12 text-stone-500">
                      Your cart is empty. Start browsing!
                    </div>
                  ) : (
                    <>
                      <ScrollArea className="h-[60vh]">
                        {cart.map((item) => (
                          <div key={item.vegetableId} className="flex items-center justify-between py-4 border-b border-stone-100">
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-stone-500">{item.quantityKg}kg × ₹{item.priceAtOrder}/kg</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <p className="font-bold">₹{(item.quantityKg * item.priceAtOrder).toFixed(2)}</p>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => removeFromCart(item.vegetableId)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </ScrollArea>
                      <div className="pt-4 space-y-4">
                        <div className="flex justify-between text-lg font-bold">
                          <span>Total</span>
                          <span>₹{cartTotal.toFixed(2)}</span>
                        </div>
                        <Button onClick={placeOrder} className="w-full bg-green-600 hover:bg-green-700 h-12">
                          Place Order
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <DropdownMenuTrigger
                nativeButton={false}
                render={
                  <Avatar className="cursor-pointer border-2 border-transparent hover:border-green-200 transition-all">
                    <AvatarImage src={user.photoURL ?? ''} />
                    <AvatarFallback><UserIcon /></AvatarFallback>
                  </Avatar>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span>{user.displayName}</span>
                      <span className="text-xs font-normal text-stone-500">{user.email}</span>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setActiveTab('orders')}>
                  My Orders
                </DropdownMenuItem>
                {profile?.role === 'admin' && (
                  <DropdownMenuItem onClick={() => setActiveTab('admin')}>
                    Admin Dashboard
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <TabsList className="bg-stone-200/50 p-1">
              <TabsTrigger value="browse">Browse Produce</TabsTrigger>
              <TabsTrigger value="orders">My Orders</TabsTrigger>
              {profile?.role === 'admin' && <TabsTrigger value="admin">Admin</TabsTrigger>}
            </TabsList>
            
            {activeTab === 'browse' && (
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <Input 
                  placeholder="Search vegetables..." 
                  className="pl-10 bg-white border-stone-200"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            )}
          </div>

          <TabsContent value="browse" className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredVegetables.map((veg) => (
                  <motion.div
                    key={veg.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <Card className="overflow-hidden border-stone-200 hover:shadow-lg transition-shadow group">
                      <div className="aspect-square relative overflow-hidden bg-stone-100">
                        <img 
                          src={veg.imageUrl || `https://picsum.photos/seed/${veg.name}/400/400`} 
                          alt={veg.name}
                          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <Badge className="absolute top-2 right-2 bg-white/90 text-stone-900 backdrop-blur-sm">
                          {veg.category}
                        </Badge>
                      </div>
                      <CardHeader className="p-4">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-xl">{veg.name}</CardTitle>
                          <span className="text-lg font-bold text-green-700">₹{veg.pricePerKg.toFixed(2)}/kg</span>
                        </div>
                        <CardDescription className="line-clamp-2">{veg.description}</CardDescription>
                      </CardHeader>
                      <CardFooter className="p-4 pt-0 flex justify-between items-center">
                        <span className="text-sm text-stone-500">{veg.stockKg}kg in stock</span>
                        <Button 
                          onClick={() => addToCart(veg)}
                          disabled={veg.stockKg <= 0}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add to Cart
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {filteredVegetables.length === 0 && (
              <div className="text-center py-20">
                <p className="text-stone-500 text-lg">No vegetables found matching your search.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="orders">
            <OrderHistory userId={profile?.uid || ''} />
          </TabsContent>

          {profile?.role === 'admin' && (
            <TabsContent value="admin">
              <AdminDashboard />
            </TabsContent>
          )}
        </Tabs>
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}

function OrderHistory({ userId }: { userId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (userId) {
      const unsubscribe = orderService.subscribeToUserOrders(userId, setOrders);
      return () => unsubscribe();
    }
  }, [userId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'confirmed': return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
      case 'ready': return <Package className="w-4 h-4 text-green-500" />;
      case 'picked_up': return <Truck className="w-4 h-4 text-stone-500" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Your Orders</h2>
      {orders.length === 0 ? (
        <Card className="p-12 text-center text-stone-500">
          You haven't placed any orders yet.
        </Card>
      ) : (
        <div className="grid gap-4">
          {orders.map((order: Order) => (
            <Card key={order.id} className="border-stone-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-medium">Order #{order.id.slice(-6)}</CardTitle>
                  <CardDescription>{new Date(order.createdAt).toLocaleDateString()}</CardDescription>
                </div>
                <Badge variant="outline" className="flex items-center gap-1 capitalize">
                  {getStatusIcon(order.status)}
                  {order.status.replace('_', ' ')}
                </Badge>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-2">
                  {order.items.map((item: OrderItem, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.name} ({item.quantityKg}kg)</span>
                      <span>₹{(item.quantityKg * item.priceAtOrder).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-stone-100 flex justify-between font-bold">
                    <span>Total</span>
                    <span>₹{order.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [vegetables, setVegetables] = useState<Vegetable[]>([]);
  const [newVeg, setNewVeg] = useState({
    name: '',
    description: '',
    pricePerKg: 0,
    stockKg: 0,
    category: 'Leafy',
    imageUrl: '',
    isAvailable: true
  });

  useEffect(() => {
    const unsubOrders = orderService.subscribeToAllOrders(setOrders);
    const unsubVeg = vegetableService.subscribeToVegetables(setVegetables);
    return () => {
      unsubOrders();
      unsubVeg();
    };
  }, []);

  const handleAddVeg = async (e: React.FormEvent) => {
    e.preventDefault();
    await vegetableService.addVegetable({
      ...newVeg,
      updatedAt: new Date().toISOString()
    });
    setNewVeg({
      name: '',
      description: '',
      pricePerKg: 0,
      stockKg: 0,
      category: 'Leafy',
      imageUrl: '',
      isAvailable: true
    });
    toast.success('Vegetable added to inventory');
  };

  const updateStatus = async (id: string, status: OrderStatus) => {
    await orderService.updateOrderStatus(id, status);
    toast.success(`Order status updated to ${status}`);
  };

  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <h2 className="text-2xl font-bold">Manage Inventory</h2>
        <div className="grid lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 border-stone-200">
            <CardHeader>
              <CardTitle>Add New Produce</CardTitle>
              <CardDescription>Add fresh vegetables to the campus store.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddVeg} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={newVeg.name} onChange={e => setNewVeg({...newVeg, name: e.target.value})} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price/kg (₹)</Label>
                    <Input id="price" type="number" step="0.01" value={newVeg.pricePerKg} onChange={e => setNewVeg({...newVeg, pricePerKg: parseFloat(e.target.value)})} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock">Stock (kg)</Label>
                    <Input id="stock" type="number" step="0.1" value={newVeg.stockKg} onChange={e => setNewVeg({...newVeg, stockKg: parseFloat(e.target.value)})} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={newVeg.category} onValueChange={v => v && setNewVeg({...newVeg, category: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Leafy">Leafy Greens</SelectItem>
                      <SelectItem value="Root">Root Vegetables</SelectItem>
                      <SelectItem value="Fruit">Fruit Vegetables</SelectItem>
                      <SelectItem value="Cruciferous">Cruciferous</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Description</Label>
                  <Input id="desc" value={newVeg.description} onChange={e => setNewVeg({...newVeg, description: e.target.value})} />
                </div>
                <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">Add Vegetable</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-stone-200">
            <CardHeader>
              <CardTitle>Current Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vegetables.map((veg: Vegetable) => (
                    <TableRow key={veg.id}>
                      <TableCell className="font-medium">{veg.name}</TableCell>
                      <TableCell>₹{veg.pricePerKg.toFixed(2)}/kg</TableCell>
                      <TableCell>{veg.stockKg}kg</TableCell>
                      <TableCell>
                        <Badge variant={veg.isAvailable ? "default" : "secondary"}>
                          {veg.isAvailable ? "Available" : "Hidden"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => vegetableService.updateVegetable(veg.id, { isAvailable: !veg.isAvailable })}
                        >
                          {veg.isAvailable ? "Hide" : "Show"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold">Manage Orders</h2>
        <Card className="border-stone-200">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order: Order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">#{order.id.slice(-6)}</TableCell>
                    <TableCell>{order.userName}</TableCell>
                    <TableCell>₹{order.totalAmount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge className="capitalize">{order.status.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={order.status} 
                        onValueChange={(v: OrderStatus | null) => v && updateStatus(order.id, v)}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="ready">Ready</SelectItem>
                          <SelectItem value="picked_up">Picked Up</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
