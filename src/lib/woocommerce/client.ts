export interface WooCommerceProduct {
  id: number;
  name: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  date_on_sale_to: string | null;
  acf: {
    horas: string;
    incluye: string;
    dirigido: string;
    formato: string;
    profesores: string[];
    objetivo: string;
  };
}

export async function fetchProduct(id: string): Promise<WooCommerceProduct> {
  const baseUrl = import.meta.env?.WOOCOMMERCE_URL;
  const key = import.meta.env?.WOOCOMMERCE_CONSUMER_KEY;
  const secret = import.meta.env?.WOOCOMMERCE_CONSUMER_SECRET;
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');

  const response = await fetch(`${baseUrl}/wp-json/wc/v3/products/${id}`, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!response.ok) {
    throw new Error(`WooCommerce product ${id} fetch failed: HTTP ${response.status}`);
  }

  return response.json();
}
