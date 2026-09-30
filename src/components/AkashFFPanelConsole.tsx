import React, { useState, useEffect } from 'react';
import { 
  Gamepad2, 
  Key, 
  Users, 
  Wallet, 
  ShieldCheck, 
  Download, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Search, 
  Send, 
  RefreshCw, 
  Crown, 
  Sparkles, 
  Ban, 
  UserCheck, 
  QrCode, 
  Smartphone, 
  Monitor, 
  FileText,
  AlertCircle
} from 'lucide-react';

interface FFProduct {
  id: number;
  category: string;
  name: string;
  panel_name?: string;
  price_inr: number;
  reseller_price: number;
  stock: number;
  apk_link: string;
  validity: string;
  device_limit: string;
  bantibhaiya_product_pid?: string;
  bantibhaiya_product_duration?: string;
  is_active: number;
  availableKeysCount?: number;
}

interface FFKey {
  id: number;
  product_id: number;
  key_text: string;
  is_used: number;
  product_name?: string;
  category?: string;
}

interface FFUser {
  user_id: number;
  first_name: string;
  username: string;
  phone: string;
  balance: number;
  account_type: string;
  orders_count: number;
  spent: number;
  joined_date: string;
  is_reseller: number;
  is_vip: number;
  is_banned: number;
}

interface FFOverview {
  totalProducts: number;
  availableKeys: number;
  totalUsers: number;
  totalBalance: number;
  totalSpent: number;
  totalOrders: number;
  botUsername: string;
  adminId: string;
}

export const AkashFFPanelConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'products' | 'users' | 'payments' | 'bot'>('products');
  const [overview, setOverview] = useState<FFOverview | null>(null);
  const [products, setProducts] = useState<FFProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [users, setUsers] = useState<FFUser[]>([]);
  const [userSearch, setUserSearch] = useState<string>('');
  const [keys, setKeys] = useState<FFKey[]>([]);
  const [selectedProductForKeys, setSelectedProductForKeys] = useState<FFProduct | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedKeyId, setCopiedKeyId] = useState<number | null>(null);

  // Modals & Form states
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [newPanelName, setNewPanelName] = useState('MST PANEL');
  const [newProductName, setNewProductName] = useState('7 Days Plan');
  const [newProductCategory, setNewProductCategory] = useState('ANDROID NON ROOT PANEL');
  const [newProductPrice, setNewProductPrice] = useState(220);
  const [newProductResellerPrice, setNewProductResellerPrice] = useState(180);
  const [newProductValidity, setNewProductValidity] = useState('7 Days');
  const [newProductPid, setNewProductPid] = useState('');
  const [newProductDuration, setNewProductDuration] = useState('7d');

  const [showGenerateKeyModal, setShowGenerateKeyModal] = useState<boolean>(false);
  const [keyGenCount, setKeyGenCount] = useState<number>(5);
  const [keyGenPrefix, setKeyGenPrefix] = useState<string>('AKASH-VIP');

  const [showBalanceModal, setShowBalanceModal] = useState<boolean>(false);
  const [targetUser, setTargetUser] = useState<FFUser | null>(null);
  const [balanceAmount, setBalanceAmount] = useState<string>('100');
  const [balanceMode, setBalanceMode] = useState<'add' | 'deduct' | 'set'>('add');

  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [broadcastStatus, setBroadcastStatus] = useState<string>('');

  // Fetch all data
  const fetchData = async () => {
    try {
      const [ovRes, prodRes, userRes] = await Promise.all([
        fetch('/api/ff-panel/overview'),
        fetch('/api/ff-panel/products'),
        fetch('/api/ff-panel/users')
      ]);

      if (ovRes.ok) setOverview(await ovRes.json());
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData.products || []);
      }
      if (userRes.ok) {
        const userData = await userRes.json();
        setUsers(userData.users || []);
      }
    } catch (e) {
      console.warn('Network sync notice:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  // Fetch keys for a specific product
  const fetchKeysForProduct = async (product: FFProduct) => {
    setSelectedProductForKeys(product);
    try {
      const res = await fetch(`/api/ff-panel/keys?productId=${product.id}`);
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Add Product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;

    try {
      const res = await fetch('/api/ff-panel/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: newProductCategory,
          panel_name: newPanelName.trim() || newProductName.trim(),
          name: newProductName.trim(),
          price_inr: newProductPrice,
          reseller_price: newProductResellerPrice,
          validity: newProductValidity || '7 Days',
          bantibhaiya_product_pid: newProductPid.trim(),
          bantibhaiya_product_duration: newProductDuration.trim(),
          device_limit: '1 Device HWID',
          apk_link: ''
        })
      });

      if (res.ok) {
        setShowAddProductModal(false);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product and its keys?')) return;
    try {
      const res = await fetch(`/api/ff-panel/products/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Generate Keys
  const handleGenerateKeys = async () => {
    if (!selectedProductForKeys) return;
    try {
      const res = await fetch('/api/ff-panel/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductForKeys.id,
          prefix: keyGenPrefix,
          count: keyGenCount
        })
      });

      if (res.ok) {
        setShowGenerateKeyModal(false);
        fetchKeysForProduct(selectedProductForKeys);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete Key
  const handleDeleteKey = async (keyId: number) => {
    try {
      const res = await fetch(`/api/ff-panel/keys/${keyId}`, { method: 'DELETE' });
      if (res.ok && selectedProductForKeys) {
        fetchKeysForProduct(selectedProductForKeys);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Copy Key
  const handleCopyKey = (keyText: string, id: number) => {
    navigator.clipboard.writeText(keyText);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  // Update Balance
  const handleUpdateBalance = async () => {
    if (!targetUser) return;
    try {
      const res = await fetch(`/api/ff-panel/users/${targetUser.user_id}/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: balanceAmount, mode: balanceMode })
      });

      if (res.ok) {
        setShowBalanceModal(false);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle VIP
  const handleToggleVip = async (userId: number) => {
    try {
      const res = await fetch(`/api/ff-panel/users/${userId}/toggle-vip`, { method: 'POST' });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle Reseller
  const handleToggleReseller = async (userId: number) => {
    try {
      const res = await fetch(`/api/ff-panel/users/${userId}/toggle-reseller`, { method: 'POST' });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle Ban
  const handleToggleBan = async (userId: number) => {
    try {
      const res = await fetch(`/api/ff-panel/users/${userId}/toggle-ban`, { method: 'POST' });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Broadcast Message
  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    setBroadcastStatus('Sending broadcast...');
    try {
      const res = await fetch('/api/ff-panel/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcastMessage })
      });

      if (res.ok) {
        const data = await res.json();
        setBroadcastStatus(`✅ Sent to ${data.sentCount} active users!`);
        setBroadcastMessage('');
        setTimeout(() => setBroadcastStatus(''), 4000);
      } else {
        setBroadcastStatus('❌ Broadcast failed');
      }
    } catch (e: any) {
      setBroadcastStatus(`❌ Error: ${e.message}`);
    }
  };

  // Filtered Products
  const filteredProducts = products.filter(p => {
    if (selectedCategory === 'ALL') return true;
    return p.category === selectedCategory;
  });

  // Filtered Users
  const filteredUsers = users.filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (
      (u.first_name && u.first_name.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      String(u.user_id).includes(q) ||
      (u.phone && u.phone.includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Brand Banner */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-rose-500/20 px-4 lg:px-8 py-3.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-600 via-red-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-600/30">
              <Gamepad2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-wider bg-gradient-to-r from-rose-400 via-amber-300 to-red-500 bg-clip-text text-transparent">
                  LOCAL SERVER & PANEL MANAGER
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  🖥 LOCALHOST:3000
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Bot: <span className="text-amber-400 font-mono font-semibold">@AKASHFFPANEL11BOT</span> | Admin: <span className="text-emerald-400 font-mono font-semibold">@Akash_12121</span> (ID: 8808556338)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Bot Online 24/7</span>
            </div>

            <a
              href="/api/python-bots/pybot_main_qr_payment/download"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-red-500 text-slate-950 font-bold text-xs hover:from-amber-400 hover:to-red-400 shadow-md shadow-amber-500/20 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Bot (.py)</span>
            </a>

            <a
              href="/api/ff-panel/users/export"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 text-xs font-semibold transition-all"
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Users Info File</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-900/60 border border-white/10 p-4 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Panel Products</span>
              <Gamepad2 className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-black mt-2 text-white">{overview?.totalProducts || products.length}</p>
            <span className="text-[11px] text-rose-400 font-medium">Android & PC Panels</span>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-900/60 border border-white/10 p-4 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Available Keys</span>
              <Key className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black mt-2 text-amber-400">{overview?.availableKeys || 0}</p>
            <span className="text-[11px] text-amber-400/80 font-medium">In Stock for Instant Delivery</span>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-900/60 border border-white/10 p-4 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Total Users</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-2xl font-black mt-2 text-cyan-300">{overview?.totalUsers || users.length}</p>
            <span className="text-[11px] text-cyan-400/80 font-medium">Akash FF Community</span>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-900/60 border border-white/10 p-4 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Wallet Circulation</span>
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black mt-2 text-emerald-400">₹{(overview?.totalBalance || 0).toFixed(2)}</p>
            <span className="text-[11px] text-emerald-400/80 font-medium">Total User Balance</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'products'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            <span>FF Products & Keys (ப்ராடக்ட் நேம் & கீஸ்)</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'users'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users Info (யூசர்ஸ் இன்போ)</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px] text-rose-300">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'payments'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>QR & UPI Payment (பேமெண்ட்)</span>
          </button>

          <button
            onClick={() => setActiveTab('bot')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'bot'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Bot Control & Broadcast</span>
          </button>
        </div>

        {/* TAB 1: PRODUCTS & KEYS */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                {['ALL', 'ANDROID NON ROOT PANEL', 'ANDROID ROOT PANEL', 'PC PANEL'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-white/10 text-white border border-rose-500/50'
                        : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    {cat === 'ANDROID NON ROOT PANEL' && '📱 NON ROOT'}
                    {cat === 'ANDROID ROOT PANEL' && '🛡️ ROOT'}
                    {cat === 'PC PANEL' && '💻 PC PANEL'}
                    {cat === 'ALL' && '⚡ ALL PRODUCTS'}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowAddProductModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold shadow-lg shadow-rose-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Add FF Product</span>
              </button>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map(p => (
                <div
                  key={p.id}
                  className="bg-slate-900/80 border border-white/10 hover:border-rose-500/40 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        p.category.includes('NON ROOT')
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : p.category.includes('ROOT')
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {p.category}
                      </span>
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-white/5 transition-colors"
                        title="Delete product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h3 className="text-base font-bold text-white group-hover:text-rose-300 transition-colors">
                      {p.panel_name ? `${p.panel_name} - ${p.name}` : p.name}
                    </h3>

                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                      {p.bantibhaiya_product_pid && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
                          PID: {p.bantibhaiya_product_pid}
                        </span>
                      )}
                      {p.bantibhaiya_product_duration && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                          API Dur: {p.bantibhaiya_product_duration}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-white/5">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Public Price</span>
                        <span className="text-base font-black text-emerald-400">₹{p.price_inr}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Reseller Price</span>
                        <span className="text-base font-black text-amber-400">₹{p.reseller_price}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Validity</span>
                        <span className="font-semibold text-slate-200">{p.validity}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Available Keys</span>
                        <span className="font-bold text-cyan-300">{p.availableKeysCount ?? 0} Keys</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center gap-2">
                    <button
                      onClick={() => fetchKeysForProduct(p)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all border border-white/10"
                    >
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      <span>Manage Keys</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedProductForKeys(p);
                        setShowGenerateKeyModal(true);
                      }}
                      className="px-3 py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all"
                      title="Generate keys for this product"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Keys Drawer / Modal if a product is selected */}
            {selectedProductForKeys && (
              <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Key className="w-5 h-5 text-amber-400" />
                      <span>Keys for: {selectedProductForKeys.name}</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Category: {selectedProductForKeys.category} | Validity: {selectedProductForKeys.validity}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowGenerateKeyModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Generate More Keys</span>
                    </button>
                    <button
                      onClick={() => setSelectedProductForKeys(null)}
                      className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-white/5"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
                  {keys.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-slate-500 text-xs">
                      No keys found for this product. Click "Generate More Keys" to add keys.
                    </div>
                  ) : (
                    keys.map(k => (
                      <div
                        key={k.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                          k.is_used
                            ? 'bg-slate-950/60 border-slate-800 text-slate-500'
                            : 'bg-slate-950 border-amber-500/30 text-amber-200'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <code className="text-xs font-mono font-bold block truncate">{k.key_text}</code>
                          <span className={`text-[10px] font-semibold ${k.is_used ? 'text-slate-500' : 'text-emerald-400'}`}>
                            {k.is_used ? 'DELIVERED / USED' : 'AVAILABLE IN STOCK'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCopyKey(k.key_text, k.id)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                            title="Copy key"
                          >
                            {copiedKeyId === k.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleDeleteKey(k.id)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                            title="Delete key"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: USERS INFO */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search user ID, @username, name..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 pl-9 pr-4 py-2 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/api/ff-panel/users/export"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-white/10 text-xs font-bold shadow transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download Users Info File</span>
                </a>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 border-b border-white/10 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">User Details</th>
                      <th className="py-3 px-4">Wallet Balance</th>
                      <th className="py-3 px-4">Account Level</th>
                      <th className="py-3 px-4">Orders & Spent</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          No users found matching search query.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map(u => (
                        <tr key={u.user_id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{u.first_name || 'Akash User'}</span>
                              {u.username && (
                                <a
                                  href={`https://t.me/${u.username}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-cyan-400 hover:underline font-mono text-[11px]"
                                >
                                  @{u.username}
                                </a>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              ID: {u.user_id} {u.phone ? `| 📱 ${u.phone}` : ''}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-black text-emerald-400 text-sm">
                              ₹{(u.balance || 0).toFixed(2)}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              {u.is_vip ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" /> VIP
                                </span>
                              ) : null}
                              {u.is_reseller ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                  <Crown className="w-3 h-3" /> Reseller
                                </span>
                              ) : null}
                              {!u.is_vip && !u.is_reseller ? (
                                <span className="text-slate-400 text-[11px]">Regular</span>
                              ) : null}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-200">
                              {u.orders_count || 0} orders
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Spent: ₹{(u.spent || 0).toFixed(2)}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {u.is_banned ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                BANNED 🚫
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                ACTIVE 🟢
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setTargetUser(u);
                                  setShowBalanceModal(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-[11px] font-bold border border-emerald-500/30"
                                title="Add/Deduct Balance"
                              >
                                ± Balance
                              </button>

                              <button
                                onClick={() => handleToggleVip(u.user_id)}
                                className={`p-1.5 rounded-lg border text-[11px] ${
                                  u.is_vip
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                                }`}
                                title="Toggle VIP Status"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleToggleReseller(u.user_id)}
                                className={`p-1.5 rounded-lg border text-[11px] ${
                                  u.is_reseller
                                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                                }`}
                                title="Toggle Reseller Status"
                              >
                                <Crown className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleToggleBan(u.user_id)}
                                className={`p-1.5 rounded-lg border text-[11px] ${
                                  u.is_banned
                                    ? 'bg-rose-600 text-white border-rose-500'
                                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-rose-400'
                                }`}
                                title={u.is_banned ? 'Unban User' : 'Ban User'}
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: QR & UPI PAYMENTS */}
        {activeTab === 'payments' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-amber-400" />
                <span>UPI QR Payment Gateway</span>
              </h3>
              <p className="text-xs text-slate-400">
                FamPay & Instant QR Payment Engine integrated in <span className="text-white font-mono">Main_QR_PAYMENT_ALL_FIXED.py</span>.
              </p>

              <div className="p-4 rounded-xl bg-slate-950 border border-white/5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Payee Name:</span>
                  <span className="font-bold text-white">AKASH FF PANEL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">UPI URI:</span>
                  <span className="font-mono text-amber-300 text-[11px]">upi://pay?pn=AKASH+FF+PANEL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Verification:</span>
                  <span className="text-emerald-400 font-bold">Auto Webhook / Verify.php</span>
                </div>
              </div>

              <div className="pt-2 text-center">
                <div className="w-44 h-44 mx-auto bg-white p-3 rounded-2xl flex items-center justify-center shadow-lg shadow-white/5">
                  <QrCode className="w-36 h-36 text-slate-950" />
                </div>
                <span className="text-[11px] text-slate-400 block mt-2">Dynamic Amount UPI QR Code</span>
              </div>
            </div>

            <div className="md:col-span-2 bg-slate-900 border border-white/10 p-6 rounded-2xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <span>Recent Orders & Delivered Keys</span>
              </h3>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 text-xs text-slate-400 space-y-2">
                <p>
                  Every time a user scans the QR or uses their wallet to purchase a Free Fire Panel, the bot automatically verifies payment, deducts balance, and delivers the key instantly with download links.
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                    Instant Delivery Active
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                    Admin Notification Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BOT & BROADCAST */}
        {activeTab === 'bot' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-rose-500" />
                <span>Broadcast to All FF Panel Users</span>
              </h3>
              <p className="text-xs text-slate-400">
                Send an instant announcement to all registered bot users directly through <span className="text-amber-400 font-mono">@AKASHFFPANEL11BOT</span>.
              </p>

              <textarea
                rows={5}
                value={broadcastMessage}
                onChange={e => setBroadcastMessage(e.target.value)}
                placeholder="🔥 NEW UPDATE: Android Non-Root VIP v3.2 is now LIVE! Use coupon VIP50 for 50% discount..."
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
              />

              {broadcastStatus && (
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-amber-300">
                  {broadcastStatus}
                </div>
              )}

              <button
                onClick={handleSendBroadcast}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Send Broadcast Message</span>
              </button>
            </div>

            <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Bot Details & Source Script</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-white/5 flex justify-between items-center">
                  <span className="text-slate-400">Bot Handle:</span>
                  <a href="https://t.me/AKASHFFPANEL11BOT" target="_blank" rel="noreferrer" className="text-amber-400 font-mono font-bold hover:underline">
                    @AKASHFFPANEL11BOT
                  </a>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-white/5 flex justify-between items-center">
                  <span className="text-slate-400">Admin Contact:</span>
                  <span className="text-emerald-400 font-mono font-bold">@Akash_12121 (8808556338)</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-white/5 flex justify-between items-center">
                  <span className="text-slate-400">Database Engine:</span>
                  <span className="text-slate-200 font-mono">SQLite (Cuibcc.db)</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-white/5 flex justify-between items-center">
                  <span className="text-slate-400">Python Script:</span>
                  <span className="text-rose-400 font-mono">Main_QR_PAYMENT_ALL_FIXED.py (2,971 lines)</span>
                </div>
              </div>

              <a
                href="/api/python-bots/pybot_main_qr_payment/download"
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-white/10 flex items-center justify-center gap-2 transition-all block text-center"
              >
                <Download className="w-4 h-4 text-amber-400 inline" />
                <span>Download Python Script (.py)</span>
              </a>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: ADD PRODUCT */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-rose-500" />
              <span>Add New Free Fire Product</span>
            </h3>

            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Product Category</label>
                <select
                  value={newProductCategory}
                  onChange={e => setNewProductCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 p-2.5 rounded-xl text-white focus:outline-none focus:border-rose-500 font-medium"
                >
                  <option value="ANDROID NON ROOT PANEL">ANDROID NON ROOT PANEL</option>
                  <option value="ANDROID ROOT PANEL">ANDROID ROOT PANEL</option>
                  <option value="PC PANEL">PC PANEL</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Panel Name (ஒரே ப்ராடக்ட் பெயர்)</label>
                <input
                  type="text"
                  placeholder="e.g. MST PANEL or VIP CHEATS"
                  value={newPanelName}
                  onChange={e => setNewPanelName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 p-2.5 rounded-xl text-white focus:outline-none focus:border-rose-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Bantibhaiya Reseller PID (பண்டி பையா PID)</label>
                <input
                  type="text"
                  placeholder="e.g. 105 (Enter Product PID manually)"
                  value={newProductPid}
                  onChange={e => setNewProductPid(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 p-2.5 rounded-xl text-white focus:outline-none focus:border-rose-500 font-mono"
                  required
                />
                <p className="text-[10px] text-amber-400 mt-1">💡 All plans under this panel share the same PID (e.g. 105).</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Plan Display Name</label>
                  <input
                    type="text"
                    placeholder="e.g. 7 Days"
                    value={newProductName}
                    onChange={e => setNewProductName(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 p-2.5 rounded-xl text-white focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">API Duration (டுரேஷன்)</label>
                  <input
                    type="text"
                    placeholder="e.g. 7d or 7 Days"
                    value={newProductDuration}
                    onChange={e => setNewProductDuration(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 p-2.5 rounded-xl text-white focus:outline-none focus:border-rose-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={newProductPrice}
                    onChange={e => setNewProductPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 p-2.5 rounded-xl text-white focus:outline-none focus:border-rose-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Reseller Price (₹)</label>
                  <input
                    type="number"
                    value={newProductResellerPrice}
                    onChange={e => setNewProductResellerPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 p-2.5 rounded-xl text-white focus:outline-none focus:border-rose-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold"
                >
                  Save Product & Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GENERATE KEYS */}
      {showGenerateKeyModal && selectedProductForKeys && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-400" />
              <span>Generate Keys</span>
            </h3>
            <p className="text-xs text-slate-400">
              For: <span className="text-white font-bold">{selectedProductForKeys.name}</span>
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Key Prefix</label>
                <input
                  type="text"
                  value={keyGenPrefix}
                  onChange={e => setKeyGenPrefix(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 p-2.5 rounded-xl text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">How many keys to generate?</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={keyGenCount}
                  onChange={e => setKeyGenCount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-white/10 p-2.5 rounded-xl text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowGenerateKeyModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerateKeys}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black"
                >
                  Generate {keyGenCount} Keys
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BALANCE UPDATE */}
      {showBalanceModal && targetUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-400" />
              <span>Modify User Balance</span>
            </h3>
            <p className="text-xs text-slate-400">
              User: <span className="text-white font-bold">{targetUser.first_name}</span> (ID: {targetUser.user_id})
            </p>

            <div className="space-y-3 text-xs">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBalanceMode('add')}
                  className={`flex-1 py-1.5 rounded-lg font-bold ${balanceMode === 'add' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                >
                  + Add
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceMode('deduct')}
                  className={`flex-1 py-1.5 rounded-lg font-bold ${balanceMode === 'deduct' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                >
                  - Deduct
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceMode('set')}
                  className={`flex-1 py-1.5 rounded-lg font-bold ${balanceMode === 'set' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                >
                  Set Exactly
                </button>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={balanceAmount}
                  onChange={e => setBalanceAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 p-2.5 rounded-xl text-white font-bold text-sm focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBalanceModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateBalance}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Confirm Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
