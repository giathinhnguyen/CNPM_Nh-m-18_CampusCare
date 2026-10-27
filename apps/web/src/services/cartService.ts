import { authenticatedFetch } from './session.js';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const LOCAL_STORAGE_KEY = 'brewlite_guest_cart';
let isSyncing = false;

export const cartService = {
    // 1. LẤY GIỎ HÀNG & TỰ ĐỘNG ĐỒNG BỘ KHÔNG BỊ DƯ
    getCart: async (isLoggedIn: boolean) => {
        if (isLoggedIn) {
            // Kiểm tra nếu có món từ lúc chưa đăng nhập thì đẩy lên DB
            const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (localData && !isSyncing) {
                isSyncing = true;
                localStorage.removeItem(LOCAL_STORAGE_KEY);
                try {
                    const localItems = JSON.parse(localData);
                    if (Array.isArray(localItems) && localItems.length > 0) {
                        await authenticatedFetch(`${API_BASE}/cart/sync`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ items: localItems }),
                        });
                    }
                } catch (err) {
                    console.error("Lỗi đồng bộ giỏ hàng:", err);
                } finally {
                    isSyncing = false;
                }
            }

            // Lấy toàn bộ giỏ hàng chuẩn từ PostgreSQL về
            try {
                const res = await authenticatedFetch(`${API_BASE}/cart`);
                if (res.ok) return await res.json();
            } catch (err) {
                console.warn("Lỗi lấy giỏ từ server");
            }
        }

        // Nếu là khách vãng lai: Lấy từ LocalStorage
        const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
        const items = localData ? JSON.parse(localData) : [];
        const totalAmount = items.reduce((sum: number, i: any) => sum + (i.isOutOfStock ? 0 : i.totalPrice), 0);
        const totalItems = items.reduce((sum: number, i: any) => sum + (i.isOutOfStock ? 0 : i.quantity), 0);

        return { items, totalAmount, totalItems };
    },

    // 2. THÊM VÀO GIỎ
    addToCart: async (itemData: any, isLoggedIn: boolean) => {
        if (isLoggedIn) {
            const res = await authenticatedFetch(`${API_BASE}/cart/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemData),
            });
            if (!res.ok) throw new Error('Thêm vào giỏ thất bại');
            return res.json();
        }

        const unitPrice = Number(itemData.unitPrice || itemData.price || 0);
        const quantity = Number(itemData.quantity || 1);
        // Nếu chưa đăng nhập: Lưu vào LocalStorage
        const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
        let items: any[] = localData ? JSON.parse(localData) : [];

        const existingIndex = items.findIndex(
            (i) =>
                i.productId === itemData.productId &&
                i.productSizeId === itemData.productSizeId &&
                i.sweetnessLevel === itemData.sweetnessLevel &&
                i.iceLevel === itemData.iceLevel &&
                JSON.stringify(i.toppingIds?.sort()) === JSON.stringify(itemData.toppingIds?.sort())
        );

        if (existingIndex > -1) {
            items[existingIndex].quantity += quantity;
            items[existingIndex].totalPrice = unitPrice * items[existingIndex].quantity;
        } else {
            items.push({
                ...itemData,
                id: crypto.randomUUID(),
                unitPrice,
                price: unitPrice,
                totalPrice: unitPrice * quantity,
                isOutOfStock: itemData.stockQuantity <= 0,
            });
        }

        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
        return { success: true };
    },

    // 3. CẬP NHẬT SỐ LƯỢNG
    updateQuantity: async (itemId: string, quantity: number, isLoggedIn: boolean) => {
        if (isLoggedIn) {
            const res = await authenticatedFetch(`${API_BASE}/cart/items/${itemId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity }),
            });
            if (!res.ok) throw new Error('Cập nhật thất bại');
            return res.json();
        }

        const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!localData) return;
        let items: any[] = JSON.parse(localData);

        if (quantity <= 0) {
            items = items.filter((i) => i.id !== itemId);
        } else {
            items = items.map((i) =>
                i.id === itemId
                    ? { ...i, quantity, totalPrice: i.unitPrice * quantity }
                    : i
            );
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    },

    // 4. XÓA MÓN
    removeItem: async (itemId: string, isLoggedIn: boolean) => {
        if (isLoggedIn) {
            const res = await authenticatedFetch(`${API_BASE}/cart/items/${itemId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Xóa thất bại');
            return res.json();
        }

        const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!localData) return;
        const items = JSON.parse(localData).filter((i: any) => i.id !== itemId);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    },
};