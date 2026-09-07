import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { translate, type TranslationKey } from "@/lib/i18n";
import pottery from "@/assets/craft-pottery.jpg";
import textile from "@/assets/craft-textile.jpg";
import brass from "@/assets/craft-brass.jpg";

export type ProductStatus = "listed" | "pending" | "sold";

export type Product = {
  id: string;
  title: string;
  category: string;
  technique: string;
  materials: string[];
  story: string;
  image: string;
  price: number;
  materialCost: number;
  labourHours: number;
  hourlyRate: number;
  benchmark: number;
  stock: number;
  status: ProductStatus;
  origin: string;
  giTag: string;
};

export type Order = {
  id: string;
  productId: string;
  buyer: string;
  location: string;
  payout: number;
  step: 0 | 1 | 2 | 3;
};

export type Channel = {
  id: string;
  name: string;
  note: string;
  synced: boolean;
};

export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "or", label: "Odia", native: "ଓଡ଼ିଆ" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

const seedProducts: Product[] = [
  {
    id: "p1",
    title: "Hand-painted Terracotta Water Pot",
    category: "Pottery & Clay",
    technique: "Wheel-thrown, kiln-fired, hand-painted",
    materials: ["River clay", "Natural oxide pigment"],
    story:
      "Shaped on a foot-powered wheel in a village where potters have read the monsoon in the clay for six generations. The eye motifs are painted to keep the water cool and the home watched over.",
    image: pottery,
    price: 1450,
    materialCost: 180,
    labourHours: 6,
    hourlyRate: 120,
    benchmark: 550,
    stock: 8,
    status: "listed",
    origin: "Kutch, Gujarat",
    giTag: "GI: Khavda Pottery",
  },
  {
    id: "p2",
    title: "Indigo Ikat Handloom Shawl",
    category: "Handloom Textile",
    technique: "Resist-dyed yarn, pit-loom weaving",
    materials: ["Organic cotton", "Natural indigo"],
    story:
      "Each thread is tied and dipped in a fermented indigo vat before it ever meets the loom, so the pattern is born in the yarn rather than printed on the cloth.",
    image: textile,
    price: 3200,
    materialCost: 640,
    labourHours: 14,
    hourlyRate: 130,
    benchmark: 740,
    stock: 3,
    status: "pending",
    origin: "Pochampally, Telangana",
    giTag: "GI: Pochampally Ikat",
  },
  {
    id: "p3",
    title: "Dhokra Brass Lantern",
    category: "Metal Craft",
    technique: "Lost-wax casting, hand filigree",
    materials: ["Bell brass", "Beeswax", "Clay mould"],
    story:
      "Cast by the lost-wax method: a wax lattice is wrapped in clay, melted away, and replaced with molten brass — the mould breaks so no two lamps can ever repeat.",
    image: brass,
    price: 4100,
    materialCost: 1100,
    labourHours: 12,
    hourlyRate: 140,
    benchmark: 1320,
    stock: 0,
    status: "sold",
    origin: "Bastar, Chhattisgarh",
    giTag: "GI: Bastar Dhokra",
  },
];

const seedOrders: Order[] = [
  {
    id: "KL-4471",
    productId: "p2",
    buyer: "Meera Textiles Co-op",
    location: "Bengaluru, Karnataka",
    payout: 3200,
    step: 1,
  },
  {
    id: "KL-4468",
    productId: "p1",
    buyer: "Terra Home Export",
    location: "Rotterdam, Netherlands",
    payout: 5800,
    step: 2,
  },
  {
    id: "KL-4460",
    productId: "p3",
    buyer: "Anand Gift House",
    location: "Raipur, Chhattisgarh",
    payout: 4100,
    step: 3,
  },
];

const seedChannels: Channel[] = [
  { id: "ondc", name: "ONDC Network", note: "Open commerce, pan-India buyers", synced: true },
  {
    id: "coop",
    name: "Local Craft Cooperative",
    note: "District haat & cluster society",
    synced: true,
  },
  { id: "b2b", name: "Global B2B Export", note: "Bulk importers, 14 countries", synced: false },
  { id: "gift", name: "Corporate Gifting Desk", note: "Festive bulk orders", synced: false },
];

export type NewProductInput = {
  title: string;
  category: string;
  technique: string;
  materials: string[];
  story: string;
  image: string;
  materialCost: number;
  labourHours: number;
  hourlyRate: number;
  benchmark: number;
  stock: number;
  origin: string;
  giTag: string;
};

export function suggestedPrice(p: {
  materialCost: number;
  labourHours: number;
  hourlyRate: number;
  benchmark: number;
}) {
  return Math.round(p.materialCost + p.labourHours * p.hourlyRate + p.benchmark);
}

type KalaContextValue = {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  t: (key: TranslationKey) => string;
  products: Product[];
  orders: Order[];
  channels: Channel[];
  toggleChannel: (id: string) => void;
  advanceOrder: (id: string) => void;
  addProduct: (input: NewProductInput) => Product;
};

const KalaContext = createContext<KalaContextValue | null>(null);

export function KalaProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [products, setProducts] = useState<Product[]>(seedProducts);
  const [orders] = useState<Order[]>(seedOrders);
  const [channels, setChannels] = useState<Channel[]>(seedChannels);

  const toggleChannel = useCallback((id: string) => {
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, synced: !c.synced } : c)));
  }, []);

  const advanceOrder = useCallback(() => {}, []);

  const addProduct = useCallback((input: NewProductInput) => {
    const product: Product = {
      ...input,
      id: `p${Math.random().toString(36).slice(2, 8)}`,
      price: suggestedPrice(input),
      status: "listed",
    };
    setProducts((prev) => [product, ...prev]);
    return product;
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translate(language, key),
    [language],
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      products,
      orders,
      channels,
      toggleChannel,
      advanceOrder,
      addProduct,
    }),
    [language, t, products, orders, channels, toggleChannel, advanceOrder, addProduct],
  );

  return <KalaContext.Provider value={value}>{children}</KalaContext.Provider>;
}

export function useKala() {
  const ctx = useContext(KalaContext);
  if (!ctx) throw new Error("useKala must be used inside KalaProvider");
  return ctx;
}

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
