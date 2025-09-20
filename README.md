# Next.js-in-Docker implementation for sandbox.pslib.cloud deployment

This is a simple Next.js application that is deployed to sandbox.pslib.cloud using Docker.

## Fundamental differences - why does this work?
TODO

---

## E-Commerce Caching Strategy

## ✅ What TO Cache (with revalidation)

### 1. Product Pages
```tsx
// app/product/[id]/page.tsx
export const revalidate = 3600; // Cache for 1 hour

export default async function ProductPage({ params }) {
  const product = await getProduct(params.id);
  return <ProductDetail product={product} />;
}
```

### 2. Category Pages  
```tsx
// app/category/[slug]/page.tsx
export const revalidate = 1800; // Cache for 30 minutes

export default async function CategoryPage({ params }) {
  const products = await getProductsByCategory(params.slug);
  return <ProductGrid products={products} />;
}
```

### 3. Homepage
```tsx
// app/page.tsx
export const revalidate = 300; // Cache for 5 minutes

export default async function HomePage() {
  const featuredProducts = await getFeaturedProducts();
  return <Homepage products={featuredProducts} />;
}
```

### 4. Static Content
```tsx
// app/about/page.tsx
export const revalidate = 86400; // Cache for 24 hours

export default function AboutPage() {
  return <StaticContent />;
}
```

## ❌ What NOT to Cache

### 1. User-Specific Pages
```tsx
// app/cart/page.tsx
export const dynamic = 'force-dynamic'; // Never cache

export default async function CartPage() {
  const user = await getUser();
  const cart = await getUserCart(user.id);
  return <Cart items={cart.items} />;
}
```

### 2. Checkout Flow
```tsx
// app/checkout/page.tsx
export const dynamic = 'force-dynamic'; // Never cache

export default async function CheckoutPage() {
  const user = await getUser();
  return <CheckoutForm user={user} />;
}
```

### 3. User Dashboard
```tsx
// app/account/page.tsx
export const dynamic = 'force-dynamic'; // Never cache

export default async function AccountPage() {
  const user = await getUser();
  const orders = await getUserOrders(user.id);
  return <Dashboard user={user} orders={orders} />;
}
```

## 🔄 Cache Invalidation

### Manual Revalidation (when products change)
```tsx
// app/lib/actions.ts
export async function updateProduct(id: string, data: ProductData) {
  await prisma.product.update({
    where: { id },
    data,
  });
  
  // Invalidate related caches
  revalidatePath(`/product/${id}`);
  revalidatePath('/'); // Homepage
  revalidatePath('/category/[slug]', 'page'); // All categories
}
```

### Tag-based Revalidation
```tsx
// Fetch with cache tags
export async function getProduct(id: string) {
  const product = await fetch(`/api/products/${id}`, {
    next: { 
      revalidate: 3600,
      tags: [`product-${id}`, 'products'] 
    }
  });
  return product.json();
}

// Invalidate by tag
revalidateTag('products'); // Invalidate all product-related caches
```

## 📊 Performance Benefits

- **Product pages**: Load instantly after first visit (1 hour cache)
- **Category pages**: Fast browsing experience (30 min cache) 
- **Homepage**: Always fresh but fast (5 min cache)
- **Static pages**: Maximum performance (24 hour cache)
- **User pages**: Always personalized (no cache)

## 🎯 Key Principles

1. **Cache static/shared content** (products, categories, homepage)
2. **Don't cache user-specific content** (cart, account, checkout)
3. **Use appropriate revalidation times** based on content change frequency
4. **Invalidate caches when data changes** using revalidatePath/revalidateTag
5. **Test caching with curl/network tools**, not just browser refresh
