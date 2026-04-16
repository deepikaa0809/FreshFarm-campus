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
import { ShoppingCart, LogOut, User as UserIcon, Plus, Trash2, CheckCircle2, Clock, Package, Truck, XCircle, Leaf, Search, RefreshCw, CreditCard, QrCode, MapPin, ChevronRight, Mail, Phone, Instagram, Facebook, Twitter, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-stone-50 p-4 text-center">
          <XCircle className="w-12 h-12 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-stone-600 mb-4 max-w-md">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [vegetables, setVegetables] = useState<Vegetable[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [activeTab, setActiveTab] = useState('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'cod'>('upi');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setUser(firebaseUser);
        if (firebaseUser) {
          try {
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
            // Seed initial data if the store is empty (only for admins)
            if (userProfile.role === 'admin' || firebaseUser.email === 'ds20050908@gmail.com') {
              await vegetableService.seedInitialData();
            }
          } catch (profileError) {
            console.error('Profile fetch/create error:', profileError);
            toast.error('Failed to load user profile');
          }
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
    const unsubscribe = vegetableService.subscribeToVegetables(setVegetables);
    return () => unsubscribe();
  }, []);

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
    if (!user || !profile) {
      handleLogin();
      return;
    }
    
    setIsProcessingPayment(true);
    try {
      const orderData = {
        userId: profile.uid,
        userName: profile.displayName,
        items: cart,
        totalAmount: cartTotal,
        status: (paymentMethod === 'cod' ? 'pending' : 'paid') as OrderStatus,
        paymentMethod,
        paymentStatus: (paymentMethod === 'cod' ? 'pending' : 'completed') as 'pending' | 'completed' | 'failed',
        deliveryAddress,
        createdAt: new Date().toISOString(),
      };
      
      const orderId = await orderService.createOrder(orderData);
      if (orderId) {
        setCart([]);
        setIsCheckoutOpen(false);
        setCheckoutStep(1);
        toast.success(paymentMethod === 'cod' ? 'Order placed successfully!' : 'Payment successful & Order placed!');
        setActiveTab('orders');
      }
    } catch (error) {
      console.error('Order placement error:', error);
      toast.error('Failed to process order');
    } finally {
      setIsProcessingPayment(false);
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

  const filteredVegetables = vegetables.filter((v: Vegetable) => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ErrorBoundary>
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
                        <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
                          <DialogTrigger
                            render={
                              <Button 
                                disabled={cart.length === 0}
                                className="w-full bg-green-600 hover:bg-green-700 h-12"
                                onClick={() => {
                                  if (!user) handleLogin();
                                  else setIsCheckoutOpen(true);
                                }}
                              >
                                {user ? 'Proceed to Checkout' : 'Sign In to Checkout'}
                              </Button>
                            }
                          />
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Checkout</DialogTitle>
                              <DialogDescription>
                                {checkoutStep === 1 ? 'Enter delivery details' : 'Choose payment method'}
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="py-4">
                              {checkoutStep === 1 ? (
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="address">Delivery Location (Campus/Hostel)</Label>
                                    <div className="relative">
                                      <MapPin className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
                                      <Input 
                                        id="address" 
                                        placeholder="e.g. Hostel 4, Room 202" 
                                        className="pl-10"
                                        value={deliveryAddress}
                                        onChange={(e) => setDeliveryAddress(e.target.value)}
                                      />
                                    </div>
                                  </div>
                                  <div className="p-4 bg-stone-50 rounded-lg border border-stone-100">
                                    <p className="text-sm font-medium text-stone-600">Order Summary</p>
                                    <div className="mt-2 flex justify-between items-center">
                                      <span className="text-stone-500">{cart.length} items</span>
                                      <span className="font-bold">₹{cartTotal.toFixed(2)}</span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 gap-3">
                                    <button
                                      onClick={() => setPaymentMethod('upi')}
                                      className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${paymentMethod === 'upi' ? 'border-green-600 bg-green-50' : 'border-stone-100 hover:border-stone-200'}`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-lg shadow-sm">
                                          <QrCode className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div className="text-left">
                                          <p className="font-bold">UPI Payment</p>
                                          <p className="text-xs text-stone-500">Google Pay, PhonePe, Paytm</p>
                                        </div>
                                      </div>
                                      {paymentMethod === 'upi' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                                    </button>

                                    {paymentMethod === 'upi' && (
                                      <motion.div 
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-4 bg-white rounded-xl border border-green-100 flex flex-col items-center gap-3 shadow-sm"
                                      >
                                        <div className="bg-stone-50 p-3 rounded-lg border border-stone-100">
                                          <img 
                                            src="https://wallpapers.com/images/hd/qr-code-9911765656-fam.jpg" 
                                            alt="UPI QR Code" 
                                            className="w-40 h-40 object-contain"
                                            referrerPolicy="no-referrer"
                                            onError={(e) => {
                                              // Fallback to a generated QR if the specific one fails
                                              (e.target as HTMLImageElement).src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=9911765656@fam&pn=FreshFarm&am=${cartTotal}&cu=INR`;
                                            }}
                                          />
                                        </div>
                                        <div className="text-center">
                                          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Scan to Pay</p>
                                          <p className="text-sm font-mono font-bold text-stone-700">9911765656@fam</p>
                                        </div>
                                      </motion.div>
                                    )}

                                    <button
                                      onClick={() => setPaymentMethod('card')}
                                      className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${paymentMethod === 'card' ? 'border-green-600 bg-green-50' : 'border-stone-100 hover:border-stone-200'}`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-lg shadow-sm">
                                          <CreditCard className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div className="text-left">
                                          <p className="font-bold">Campus Card</p>
                                          <p className="text-xs text-stone-500">Use your student/staff ID card</p>
                                        </div>
                                      </div>
                                      {paymentMethod === 'card' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                                    </button>

                                    <button
                                      onClick={() => setPaymentMethod('cod')}
                                      className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${paymentMethod === 'cod' ? 'border-green-600 bg-green-50' : 'border-stone-100 hover:border-stone-200'}`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-lg shadow-sm">
                                          <Truck className="w-5 h-5 text-stone-600" />
                                        </div>
                                        <div className="text-left">
                                          <p className="font-bold">Cash on Delivery</p>
                                          <p className="text-xs text-stone-500">Pay when you receive</p>
                                        </div>
                                      </div>
                                      {paymentMethod === 'cod' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            <DialogFooter>
                              {checkoutStep === 1 ? (
                                <Button 
                                  onClick={() => setCheckoutStep(2)} 
                                  disabled={!deliveryAddress}
                                  className="w-full bg-green-600 hover:bg-green-700"
                                >
                                  Continue to Payment
                                  <ChevronRight className="w-4 h-4 ml-2" />
                                </Button>
                              ) : (
                                <div className="flex gap-2 w-full">
                                  <Button variant="outline" onClick={() => setCheckoutStep(1)} className="flex-1">
                                    Back
                                  </Button>
                                  <Button 
                                    onClick={placeOrder} 
                                    disabled={isProcessingPayment}
                                    className="flex-[2] bg-green-600 hover:bg-green-700"
                                  >
                                    {isProcessingPayment ? 'Processing...' : `Pay ₹${cartTotal.toFixed(2)}`}
                                  </Button>
                                </div>
                              )}
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            {user ? (
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
            ) : (
              <Button onClick={handleLogin} className="bg-green-600 hover:bg-green-700">
                Sign In
              </Button>
            )}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <TabsList className="bg-stone-200/50 p-1">
              <TabsTrigger value="browse">Browse Produce</TabsTrigger>
              {user && <TabsTrigger value="orders">My Orders</TabsTrigger>}
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
            {vegetables.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-stone-200">
                <Leaf className="w-12 h-12 text-stone-200 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-stone-900">Store is currently empty</h3>
                <p className="text-stone-500 mt-2 mb-6">
                  {user ? 
                    (profile?.role === 'admin' || user.email === 'ds20050908@gmail.com' ? 
                      "You are an admin. Click below to populate the store with default inventory." : 
                      "Please check back later when the inventory is updated.") : 
                    "Please sign in to see if you have permission to manage the store, or check back later."}
                </p>
                {(!user) && (
                  <Button onClick={handleLogin} className="bg-green-600 hover:bg-green-700">
                    Sign In
                  </Button>
                )}
                {(user && (profile?.role === 'admin' || user.email === 'ds20050908@gmail.com')) && (
                  <Button onClick={async () => {
                    await vegetableService.seedInitialData();
                    toast.success('Store populated successfully!');
                  }} className="bg-green-600 hover:bg-green-700 gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Populate Store
                  </Button>
                )}
              </div>
            ) : filteredVegetables.length === 0 ? (
              <div className="text-center py-20">
                <Search className="w-12 h-12 text-stone-200 mx-auto mb-4" />
                <p className="text-stone-500 text-lg">No vegetables found matching "{searchQuery}".</p>
              </div>
            ) : (
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
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${veg.name}/400/400`;
                            }}
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

      <footer className="bg-stone-900 text-stone-300 pt-16 pb-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-white">
                <Leaf className="w-6 h-6 text-green-500" />
                <span className="text-xl font-bold">FreshFarm@Campus</span>
              </div>
              <p className="text-sm leading-relaxed">
                Bringing the freshest, locally-grown organic produce directly from our campus greenhouse to your doorstep. Healthy eating made easy for students and staff.
              </p>
              <div className="flex gap-4 pt-2">
                <a href="#" className="hover:text-green-500 transition-colors"><Instagram className="w-5 h-5" /></a>
                <a href="#" className="hover:text-green-500 transition-colors"><Facebook className="w-5 h-5" /></a>
                <a href="#" className="hover:text-green-500 transition-colors"><Twitter className="w-5 h-5" /></a>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-white font-bold">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><button onClick={() => setActiveTab('browse')} className="hover:text-green-500 transition-colors">Browse Produce</button></li>
                <li><button onClick={() => setActiveTab('orders')} className="hover:text-green-500 transition-colors">My Orders</button></li>
                <li><a href="#" className="hover:text-green-500 transition-colors">About Our Farm</a></li>
                <li><a href="#" className="hover:text-green-500 transition-colors">Sustainability Goals</a></li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-white font-bold">Contact Us</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-green-500" />
                  <span>K.R. Mangalam University, Sohna Road, Gurugram, Haryana 122103</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-green-500" />
                  <span>+91 99117 65656</span>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-green-500" />
                  <span>freshfarm@krmangalam.edu.in</span>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-white font-bold">Find Us</h4>
              <div className="rounded-xl overflow-hidden h-48 border border-stone-800">
                <iframe 
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3513.568469374465!2d77.0601333754865!3d28.28108497585844!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x390d3d6666666667%3A0x868725832a81389e!2sK.R.%20Mangalam%20University!5e0!3m2!1sen!2sin!4v1713000000000!5m2!1sen!2sin" 
                  width="100%" 
                  height="100%" 
                  style={{ border: 0 }} 
                  allowFullScreen 
                  loading="lazy" 
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-stone-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-stone-500">
            <p>© 2024 FreshFarm@Campus. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-stone-300 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-stone-300 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-stone-300 transition-colors flex items-center gap-1">
                Admin Portal <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </footer>

      <Toaster position="top-center" />
    </div>
    </ErrorBoundary>
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
      case 'paid': return <CreditCard className="w-4 h-4 text-green-600" />;
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
            <Card key={order.id} className="border-stone-200 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 bg-stone-50/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">Order #{order.id.slice(-6)}</CardTitle>
                    <Badge variant="outline" className="flex items-center gap-1 capitalize py-0">
                      {getStatusIcon(order.status)}
                      {order.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <CardDescription>{new Date(order.createdAt).toLocaleString()}</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-700">₹{order.totalAmount.toFixed(2)}</p>
                  <p className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">
                    {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 
                     order.paymentMethod === 'upi' ? 'UPI Paid' : 
                     order.paymentMethod === 'card' ? 'Campus Card' : 'Payment Pending'}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-stone-400 uppercase">Items</p>
                    {order.items.map((item: OrderItem, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.name} ({item.quantityKg}kg)</span>
                        <span className="text-stone-500">₹{(item.quantityKg * item.priceAtOrder).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-stone-400 uppercase">Delivery Details</p>
                    <div className="flex items-start gap-2 text-sm text-stone-600">
                      <MapPin className="w-4 h-4 mt-0.5 text-stone-400" />
                      <span>{order.deliveryAddress || 'Pickup from Greenhouse'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-stone-600">
                      <CreditCard className="w-4 h-4 text-stone-400" />
                      <span className="capitalize">{order.paymentMethod || 'Not specified'} - {order.paymentStatus || 'pending'}</span>
                    </div>
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

  const handleSyncData = async () => {
    try {
      await vegetableService.seedInitialData();
      toast.success('Inventory synced with default data');
    } catch (error) {
      toast.error('Failed to sync data');
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl font-bold">Admin Dashboard</h2>
        <Button variant="outline" onClick={handleSyncData} className="gap-2 border-stone-200">
          <RefreshCw className="w-4 h-4" />
          Sync Default Data
        </Button>
      </div>

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
                  <TableHead>Payment</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order: Order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">#{order.id.slice(-6)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{order.userName}</span>
                        <span className="text-[10px] text-stone-400">{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold">₹{order.totalAmount.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs uppercase font-bold">{order.paymentMethod || 'COD'}</span>
                        <span className={`text-[10px] ${order.paymentStatus === 'completed' ? 'text-green-600' : 'text-amber-600'}`}>
                          {order.paymentStatus || 'pending'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-xs">
                      {order.deliveryAddress || 'Pickup'}
                    </TableCell>
                    <TableCell>
                      <Badge className="capitalize text-[10px] py-0">{order.status.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={order.status} 
                        onValueChange={(v: OrderStatus | null) => v && updateStatus(order.id, v)}
                      >
                        <SelectTrigger className="w-[110px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
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
