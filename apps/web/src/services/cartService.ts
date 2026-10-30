import { authenticatedFetch } from './session.js';
import { syncGuestCart } from './guestCartSync';
import { getCartOwner } from './cartIntegrationService';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const LOCAL_STORAGE_KEY = 'brewlite_guest_cart';

export const cartService = {
    // 1. LẤY GIỎ HÀNG & TỰ ĐỘNG ĐỒNG BỘ KHÔNG BỊ DƯ
    getCart: async (isLoggedIn: boolean) => {
        if (isLoggedIn) {
            const owner = getCartOwner();
            if (!owner) throw new Error('Vui lòng đăng nhập lại');
            const syncData = await syncGuestCart(owner, (body) =>
                authenticatedFetch(`${API_BASE}/cart/sync-once`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                }), getCartOwner) as { warnings?: string[] } | undefined;
            if (syncData?.warnings?.length) {
                sessionStorage.setItem('brewlite_sync_warnings', JSON.stringify(syncData.warnings));
            }

            // Lấy toàn bộ giỏ hàng chuẩn từ PostgreSQL về
            const res = await authenticatedFetch(`${API_BASE}/cart`);
            if (!res.ok) throw new Error('Không thể tải giỏ hàng. Vui lòng thử lại');
            const cart = await res.json();
            if (getCartOwner() !== owner) throw new Error('Tài khoản đã thay đổi. Vui lòng tải lại giỏ');
            return cart;
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
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || 'Thêm vào giỏ thất bại');
            }
            return res.json();
        }

        const unitPrice = Number(itemData.unitPrice || itemData.price || 0);
        const quantity = Number(itemData.quantity || 1);
        // Nếu chưa đăng nhập: Lưu vào LocalStorage
        const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
        let items: any[] = localData ? JSON.parse(localData) : [];

        // Kiểm tra tồn kho cho khách vãng lai
        const currentQtyInCart = items
            .filter((i) => i.productId === itemData.productId)
            .reduce((sum: number, i: any) => sum + i.quantity, 0);

        if (itemData.stockQuantity !== undefined && currentQtyInCart + quantity > itemData.stockQuantity) {
            throw new Error(
                `Hiện số lượng tối đa của món ${itemData.productName || itemData.name || "này"} là ${itemData.stockQuantity} ly (tính cả các lựa chọn đã có trong giỏ).`
            );
        }

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
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || 'Cập nhật thất bại');
            }
            return res.json();
        }

        const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!localData) return;
        let items: any[] = JSON.parse(localData);

        const currentItem = items.find((i) => i.id === itemId);
        if (currentItem && quantity > currentItem.quantity) {
            const currentOtherQty = items
                .filter((i) => i.id !== itemId && i.productId === currentItem.productId)
                .reduce((sum: number, i: any) => sum + i.quantity, 0);
            if (currentItem.stockQuantity !== undefined && currentOtherQty + quantity > currentItem.stockQuantity) {
                throw new Error(
                    `Hiện số lượng tối đa của món ${currentItem.productName || currentItem.name || "này"} là ${currentItem.stockQuantity} ly (tính cả các lựa chọn đã có trong giỏ).`
                );
            }
        }

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

    // 5. CẬP NHẬT GHI CHÚ
    updateNote: async (itemId: string, note: string, isLoggedIn: boolean) => {
        if (isLoggedIn) {
            try {
                await authenticatedFetch(`${API_BASE}/cart/items/${itemId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ note }),
                });
            } catch (err) {
                console.warn("Lỗi lưu ghi chú trên server", err);
            }
        }

        const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!localData) return;
        let items: any[] = JSON.parse(localData);
        items = items.map((i: any) => (i.id === itemId ? { ...i, note } : i));
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    },
};
