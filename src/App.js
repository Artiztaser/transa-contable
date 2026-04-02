 import React, { useEffect, useMemo, useState } from 'react';
 import { supabase } from './lib/supabase';
import {
BarChart,
Bar,
PieChart,
Pie,
Cell,
XAxis,
YAxis,
CartesianGrid,
Tooltip,
Legend,
ResponsiveContainer,
LineChart,
Line,
} from 'recharts';
import {
Plus,
Trash2,
LogOut,
Menu,
X,
Upload,
CheckCircle2,
XCircle,
Send,
FileText,
Search,
AlertCircle,
Download,
AlertTriangle,
Eye,
TrendingUp,
TrendingDown,
DollarSign,
BarChart3,
} from 'lucide-react';

const STORAGE_KEYS = {
user: 'bt_user',
clients: 'bt_clients',
invoices: 'bt_invoices',
purchaseInvoices: 'bt_purchase_invoices',
expenses: 'bt_expenses',
};

const COMPANY = {
legalName: 'BELA TRANSA PUBLISHING, SL',
taxId: 'B72862006',
address: 'C/ Solana de Luche, 20, 28011 Madrid',
};

const APP_NAME = 'Transa Contable';
const APP_TAGLINE = 'Contabilidad de Bela Transa';

const USE_SUPABASE = true;

const EMPTY_INVOICE_ITEM = {
description: '',
baseAmount: 0,
quantity: 0,
tax: 21,
};

const getToday = () => new Date().toISOString().split('T')[0];

const addDaysToDateString = (dateString, days) => {
const d = new Date(dateString);
d.setDate(d.getDate() + days);
return d.toISOString().split('T')[0];
};

const getDefaultInvoiceForm = () => {
const today = getToday();
return {
clientId: '',
issueDate: today,
dueDate: addDaysToDateString(today, 30),
orderNumber: '',
retentionPercentage: 0,
visibleNotes: '',
internalNotes: '',
items: [{ ...EMPTY_INVOICE_ITEM }],
};
};

const getDefaultClientForm = () => ({
fiscalName: '',
commercialName: '',
cif: '',
email: '',
phone: '',
address: '',
city: '',
postalCode: '',
country: 'España',
contactPerson: '',
clientType: 'company',
notes: '',
});

const getDefaultPurchaseInvoiceForm = () => ({
issuerName: '',
issuerTaxId: '',
issueDate: getToday(),
paymentDate: '',
concept: '',
category: 'general',
taxableBase: 0,
taxPercentage: 21,
withholdingPercentage: 0,
notes: '',
attachmentName: '',
paymentStatus: 'pending',
});

const getDefaultExpenseForm = () => ({
description: '',
category: 'general',
issueDate: getToday(),
paymentDate: '',
taxableBase: 0,
taxPercentage: 21,
notes: '',
receiptName: '',
hasReceipt: false,
});

const quarterMap = {
full: null,
q1: [0, 1, 2],
q2: [3, 4, 5],
q3: [6, 7, 8],
q4: [9, 10, 11],
};

const CLIENT_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

const formatCurrency = (value) =>
new Intl.NumberFormat('es-ES', {
style: 'currency',
currency: 'EUR',
}).format(Number(value || 0));

const formatDate = (value) => {
if (!value) return '-';
const d = new Date(value);
if (Number.isNaN(d.getTime())) return '-';
return d.toLocaleDateString('es-ES');
};

const safeParse = (value, fallback) => {
try {
return value ? JSON.parse(value) : fallback;
} catch {
return fallback;
}
};

const saveToStorage = (key, value) => {
try {
localStorage.setItem(key, JSON.stringify(value));
} catch (error) {
console.error(`Error guardando ${key}:`, error);
}
};

const isValidEmail = (email) => {
if (!email) return true;
return /^[^\s@]+@[^\s@]+.[^\s@]+$/.test(email);
};

const isValidCIF = (cif) => {
if (!cif) return true;
return /^[A-Z0-9]{8,9}$/.test(cif.toUpperCase());
};

const calculateInvoiceTotals = (items, retentionPercentage) => {
let subtotal = 0;
let totalTax = 0;

items.forEach((item) => {
const quantity = Number(item.quantity || 1);
const baseAmount = Number(item.baseAmount || 0);
const tax = Number(item.tax || 0);


const lineBase = baseAmount * quantity;
const taxAmount = lineBase * (tax / 100);

subtotal += lineBase;
totalTax += taxAmount;


});

const retentionAmount = subtotal * (Number(retentionPercentage || 0) / 100);
const total = subtotal + totalTax - retentionAmount;

return {
subtotal: round2(subtotal),
totalTax: round2(totalTax),
retentionPercentage: Number(retentionPercentage || 0),
retentionAmount: round2(retentionAmount),
total: round2(total),
};
};

const calculatePurchaseOrExpenseTotals = ({
taxableBase,
taxPercentage,
withholdingPercentage = 0,
}) => {
const base = Number(taxableBase || 0);
const taxPct = Number(taxPercentage || 0);
const whPct = Number(withholdingPercentage || 0);

const taxAmount = base * (taxPct / 100);
const withholdingAmount = base * (whPct / 100);
const total = base + taxAmount - withholdingAmount;

return {
taxableBase: round2(base),
taxPercentage: taxPct,
taxAmount: round2(taxAmount),
withholdingPercentage: whPct,
withholdingAmount: round2(withholdingAmount),
total: round2(total),
};
};

const getItemDate = (item) => item.issueDate || item.date || item.createdAt || null;

const filterByPeriod = (data, selectedYear, selectedQuarter) => {
return data.filter((item) => {
const rawDate = getItemDate(item);
if (!rawDate) return false;


const d = new Date(rawDate);
if (Number.isNaN(d.getTime())) return false;
if (String(d.getFullYear()) !== String(selectedYear)) return false;

const quarterMonths = quarterMap[selectedQuarter];
if (!quarterMonths) return true;

return quarterMonths.includes(d.getMonth());


});
};

const getEffectiveInvoiceStatus = (invoice) => {
if (invoice.status === 'paid') return 'paid';
if (invoice.status === 'draft') return 'draft';

if (invoice.status === 'sent') {
if (invoice.dueDate) {
const due = new Date(invoice.dueDate);
const now = new Date();
due.setHours(23, 59, 59, 999);
if (due < now) return 'overdue';
}
return 'sent';
}

return invoice.status || 'draft';
};

const getInvoiceStatusLabel = (status) => {
switch (status) {
case 'draft':
return 'Borrador';
case 'sent':
return 'Pendiente';
case 'paid':
return 'Pagada';
case 'overdue':
return 'Vencida';
default:
return status;
}
};

const getInvoiceStatusClass = (status) => {
switch (status) {
case 'paid':
return 'bg-green-100 text-green-800';
case 'overdue':
return 'bg-red-100 text-red-800';
case 'draft':
return 'bg-gray-100 text-gray-800';
case 'sent':
default:
return 'bg-yellow-100 text-yellow-800';
}
};

const sortByDateDesc = (arr, fieldCandidates = ['issueDate', 'date', 'createdAt']) => {
return [...arr].sort((a, b) => {
// Para facturas: ordenar primero por número (de mayor a menor)
// Luego por fecha (más reciente primero)


const aNum = extractInvoiceNumber(a.invoiceNumber);
const bNum = extractInvoiceNumber(b.invoiceNumber);

// Si tienen números de factura, ordenar por número primero
if (aNum || bNum) {
  if (aNum !== bNum) {
    return bNum - aNum; // Mayor número primero (003 antes que 002)
  }
}

// Si los números son iguales o no existen, ordenar por fecha
const aDate = fieldCandidates.map((f) => a[f]).find(Boolean);
const bDate = fieldCandidates.map((f) => b[f]).find(Boolean);
return new Date(bDate || 0) - new Date(aDate || 0);


});
};

const extractInvoiceNumber = (invoiceNumber) => {
if (!invoiceNumber) return 0;
// Extrae los últimos números de formato "FAC-2024-001"
const parts = invoiceNumber.split('-');
return Number(parts[parts.length - 1] || 0);
};

const generateInvoiceNumber = (existingInvoices, issueDate) => {
const year = new Date(issueDate).getFullYear();

// Filtra facturas del mismo año y extrae sus números
const numbersThisYear = existingInvoices
.filter((invoice) => invoice.invoiceNumber?.startsWith(`FAC-${year}-`))
.map((invoice) => {
const parts = invoice.invoiceNumber.split('-');
return Number(parts[2] || 0);
});

// Encuentra el número máximo existente (ej: si tienes 001, 002, 003 → obtiene 3)
const maxNumber = numbersThisYear.length > 0
? Math.max(...numbersThisYear)
: 0;

// Genera el siguiente número correlativo (3 dígitos: 001, 002, 003, 004...)
const nextNumber = maxNumber + 1;
const paddedNumber = String(nextNumber).padStart(3, '0');

return `FAC-${year}-${paddedNumber}`;

// EJEMPLO DE FUNCIONAMIENTO:
// Si existingInvoices contiene: FAC-2026-001, FAC-2026-002, FAC-2026-003
// → maxNumber = 3
// → nextNumber = 4
// → retorna: FAC-2026-004 ✓
};





const createDemoData = () => {
const clients = [
{
id: 'c1',
fiscalName: 'Sony Music Entertainment España, S.L.',
commercialName: 'Sony Music',
cif: 'B12345678',
email: 'proveedores@sony.example',
phone: '910000001',
address: 'Calle Ejemplo 1',
city: 'Madrid',
postalCode: '28001',
country: 'España',
contactPerson: 'María',
clientType: 'company',
notes: 'Cliente grande. Suele requerir orden de compra.',
createdAt: '2026-01-05T10:00:00.000Z',
},
{
id: 'c2',
fiscalName: 'Late Checkout Productions S.L.',
commercialName: 'Late Checkout',
cif: 'B22345678',
email: 'accounts@latecheckout.example',
phone: '910000002',
address: 'Calle Rodaje 2',
city: 'Madrid',
postalCode: '28002',
country: 'España',
contactPerson: 'Álvaro',
clientType: 'professional',
notes: '',
createdAt: '2026-01-12T10:00:00.000Z',
},
{
id: 'c3',
fiscalName: 'Zara España, S.A.',
commercialName: 'Zara',
cif: 'A32345678',
email: 'billing@zara.example',
phone: '910000003',
address: 'Avenida Moda 3',
city: 'A Coruña',
postalCode: '15001',
country: 'España',
contactPerson: 'Producción',
clientType: 'company',
notes: '',
createdAt: '2026-02-10T10:00:00.000Z',
},
];

const invoices = [
{
id: 'i1',
invoiceNumber: 'FAC-2026-001',
clientId: 'c1',
issueDate: '2026-01-15',
dueDate: '2026-02-14',
paymentDate: '2026-02-05',
orderNumber: 'PO-SONY-2026-001',
visibleNotes: 'Prestación de servicios de producción musical.',
internalNotes: 'Cliente estratégico.',
items: [
{
description: 'Producción musical campaña',
baseAmount: 1500,
quantity: 1,
tax: 21,
},
],
status: 'paid',
...calculateInvoiceTotals(
[{ description: 'Producción musical campaña', baseAmount: 1500, quantity: 1, tax: 21 }],
0
),
createdAt: '2026-01-15T10:00:00.000Z',
},
{
id: 'i2',
invoiceNumber: 'FAC-2026-002',
clientId: 'c2',
issueDate: '2026-02-10',
dueDate: '2026-03-12',
paymentDate: null,
orderNumber: '',
visibleNotes: '',
internalNotes: '',
items: [
{
description: 'Arreglos y mezcla',
baseAmount: 1200,
quantity: 1,
tax: 21,
},
],
status: 'sent',
...calculateInvoiceTotals(
[{ description: 'Arreglos y mezcla', baseAmount: 1200, quantity: 1, tax: 21 }],
15
),
createdAt: '2026-02-10T10:00:00.000Z',
},
{
id: 'i3',
invoiceNumber: 'FAC-2026-003',
clientId: 'c3',
issueDate: '2026-03-05',
dueDate: '2026-04-04',
paymentDate: null,
orderNumber: 'OC-ZARA-777',
visibleNotes: '',
internalNotes: '',
items: [
{
description: 'Composición original',
baseAmount: 3000,
quantity: 1,
tax: 21,
},
],
status: 'sent',
...calculateInvoiceTotals(
[{ description: 'Composición original', baseAmount: 3000, quantity: 1, tax: 21 }],
0
),
createdAt: '2026-03-05T10:00:00.000Z',
},
];

const purchaseInvoices = [
{
id: 'pi1',
issuerName: 'Software Musical Pro S.L.',
issuerTaxId: 'B88888888',
issueDate: '2026-01-20',
paymentDate: '2026-01-21',
concept: 'Suscripción anual plugins',
category: 'software',
notes: '',
attachmentName: 'factura_plugins.pdf',
paymentStatus: 'paid',
...calculatePurchaseOrExpenseTotals({
taxableBase: 400,
taxPercentage: 21,
withholdingPercentage: 0,
}),
createdAt: '2026-01-20T10:00:00.000Z',
},
{
id: 'pi2',
issuerName: 'Estudio Central Madrid S.L.',
issuerTaxId: 'B99999999',
issueDate: '2026-03-10',
paymentDate: '',
concept: 'Alquiler sala grabación',
category: 'studio',
notes: '',
attachmentName: '',
paymentStatus: 'pending',
...calculatePurchaseOrExpenseTotals({
taxableBase: 600,
taxPercentage: 21,
withholdingPercentage: 0,
}),
createdAt: '2026-03-10T10:00:00.000Z',
},
];

const expenses = [
{
id: 'e1',
description: 'Taxi a sesión',
category: 'travel',
issueDate: '2026-01-18',
paymentDate: '2026-01-18',
notes: '',
receiptName: 'taxi.jpg',
hasReceipt: true,
...calculatePurchaseOrExpenseTotals({
taxableBase: 18,
taxPercentage: 10,
withholdingPercentage: 0,
}),
createdAt: '2026-01-18T10:00:00.000Z',
},
{
id: 'e2',
description: 'Comida de trabajo',
category: 'general',
issueDate: '2026-02-08',
paymentDate: '2026-02-08',
notes: '',
receiptName: 'ticket_comida.jpg',
hasReceipt: true,
...calculatePurchaseOrExpenseTotals({
taxableBase: 32,
taxPercentage: 10,
withholdingPercentage: 0,
}),
createdAt: '2026-02-08T10:00:00.000Z',
},
];

return { clients, invoices, purchaseInvoices, expenses };
};

function LoginScreen({ onGoogleAuth, onLocalLogin, onLoadDemo }) {
return (
<div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-800 flex items-center justify-center p-4">
<div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
<div className="text-center mb-8">
<h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
{APP_NAME}
</h1>
<p className="text-gray-600 text-sm font-medium">{APP_TAGLINE}</p>
<div className="h-1 w-12 bg-gradient-to-r from-indigo-600 to-purple-600 mx-auto mt-4 rounded-full"></div>
</div>


    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 flex gap-3">
      <AlertCircle className="text-orange-600 flex-shrink-0" size={20} />
      <div className="text-sm text-orange-800">
        <p className="font-semibold mb-1">⚠️ Datos locales</p>
        <p>Los datos se guardan en este navegador. Limpiar caché = perder datos.</p>
      </div>
    </div>

    <div className="space-y-3">
      <button
        onClick={onGoogleAuth}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
      >
        Conectar con Google Drive
      </button>

      <button
        onClick={onLocalLogin}
        className="w-full bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
      >
        Modo Local
      </button>

      <button
        onClick={onLoadDemo}
        className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
      >
        Cargar Demo y Entrar
      </button>
    </div>
  </div>
</div>


);
}

function DashboardPage({
selectedPeriod,
setSelectedPeriod,
selectedQuarter,
setSelectedQuarter,
invoices,
purchaseInvoices,
expenses,
clients,
}) {
const filteredInvoices = useMemo(
() => filterByPeriod(invoices, selectedPeriod, selectedQuarter),
[invoices, selectedPeriod, selectedQuarter]
);

const filteredPurchaseInvoices = useMemo(
() => filterByPeriod(purchaseInvoices, selectedPeriod, selectedQuarter),
[purchaseInvoices, selectedPeriod, selectedQuarter]
);

const filteredExpenses = useMemo(
() => filterByPeriod(expenses, selectedPeriod, selectedQuarter),
[expenses, selectedPeriod, selectedQuarter]
);

const totalIncome = round2(
filteredInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0)
);

const totalInvoiceVAT = round2(
filteredInvoices.reduce((sum, inv) => sum + Number(inv.totalTax || 0), 0)
);

const totalPurchaseInvoiceOut = round2(
filteredPurchaseInvoices.reduce((sum, item) => sum + Number(item.total || 0), 0)
);

const totalExpenseOut = round2(
filteredExpenses.reduce((sum, item) => sum + Number(item.total || 0), 0)
);

const totalOut = round2(totalPurchaseInvoiceOut + totalExpenseOut);

const totalInputVAT = round2(
filteredPurchaseInvoices.reduce((sum, item) => sum + Number(item.taxAmount || 0), 0) +
filteredExpenses.reduce((sum, item) => sum + Number(item.taxAmount || 0), 0)
);

const vatToDeclare = round2(totalInvoiceVAT - totalInputVAT);
const operationalResult = round2(totalIncome - totalOut);
const netAfterVAT = round2(operationalResult - vatToDeclare);

// 🚨 Facturas vencidas sin pagar
const overdueInvoices = filteredInvoices.filter(
(inv) => getEffectiveInvoiceStatus(inv) === 'overdue' && inv.status !== 'paid'
);

const selectedYearNumber = Number(selectedPeriod);

const monthlyData = Array.from({ length: 12 }, (_, monthIndex) => {
const monthDate = new Date(selectedYearNumber, monthIndex, 1);


const monthInvoices = invoices.filter((item) => {
  const d = new Date(item.issueDate);
  return d.getFullYear() === selectedYearNumber && d.getMonth() === monthIndex;
});

const monthPurchaseInvoices = purchaseInvoices.filter((item) => {
  const d = new Date(item.issueDate);
  return d.getFullYear() === selectedYearNumber && d.getMonth() === monthIndex;
});

const monthExpenses = expenses.filter((item) => {
  const d = new Date(item.issueDate);
  return d.getFullYear() === selectedYearNumber && d.getMonth() === monthIndex;
});

const ingresos = round2(
  monthInvoices.reduce((sum, item) => sum + Number(item.total || 0), 0)
);

const gastos = round2(
  monthPurchaseInvoices.reduce((sum, item) => sum + Number(item.total || 0), 0) +
    monthExpenses.reduce((sum, item) => sum + Number(item.total || 0), 0)
);

return {
  month: monthDate.toLocaleString('es-ES', { month: 'short' }),
  ingresos,
  gastos,
  beneficio: round2(ingresos - gastos),
};


});

const treasuryData = Array.from({ length: 12 }, (_, monthIndex) => {
const monthDate = new Date(selectedYearNumber, monthIndex, 1);


const inflows = invoices
  .filter((invoice) => invoice.paymentDate)
  .filter((invoice) => new Date(invoice.paymentDate).getFullYear() === selectedYearNumber)
  .filter((invoice) => new Date(invoice.paymentDate).getMonth() === monthIndex)
  .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);

const outPurchase = purchaseInvoices
  .filter((invoice) => invoice.paymentDate)
  .filter((invoice) => new Date(invoice.paymentDate).getFullYear() === selectedYearNumber)
  .filter((invoice) => new Date(invoice.paymentDate).getMonth() === monthIndex)
  .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);

const outExpenses = expenses
  .filter((expense) => expense.paymentDate || expense.issueDate)
  .filter((expense) => {
    const d = new Date(expense.paymentDate || expense.issueDate);
    return d.getFullYear() === selectedYearNumber && d.getMonth() === monthIndex;
  })
  .reduce((sum, expense) => sum + Number(expense.total || 0), 0);

const salidas = round2(outPurchase + outExpenses);

return {
  month: monthDate.toLocaleString('es-ES', { month: 'short' }),
  entradas: round2(inflows),
  salidas,
  neto: round2(inflows - salidas),
};


});

const invoiceStatusData = [
{
name: 'Pagadas',
value: filteredInvoices.filter((inv) => getEffectiveInvoiceStatus(inv) === 'paid').length,
fill: '#10b981',
},
{
name: 'Pendientes',
value: filteredInvoices.filter((inv) => getEffectiveInvoiceStatus(inv) === 'sent').length,
fill: '#f59e0b',
},
{
name: 'Vencidas',
value: filteredInvoices.filter((inv) => getEffectiveInvoiceStatus(inv) === 'overdue').length,
fill: '#ef4444',
},
].filter((item) => item.value > 0);

const topClients = clients
.map((client) => ({
name: client.commercialName || client.fiscalName,
value: round2(
filteredInvoices
.filter((invoice) => invoice.clientId === client.id)
.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0)
),
}))
.filter((client) => client.value > 0)
.sort((a, b) => b.value - a.value)
.slice(0, 5);

const recentInvoices = sortByDateDesc(filteredInvoices, ['issueDate']).slice(0, 5);
const recentOutgoing = sortByDateDesc(
[...filteredPurchaseInvoices, ...filteredExpenses],
['issueDate']
).slice(0, 5);

const yearOptions = ['2024', '2025', '2026', '2027'];

return (
<div className="space-y-6">
<div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
<div className="flex gap-6 flex-wrap items-end">
<div>
<label className="block text-sm font-semibold text-gray-700 mb-3">Año</label>
<select
value={selectedPeriod}
onChange={(e) => setSelectedPeriod(e.target.value)}
className="border-2 border-gray-200 rounded-lg px-4 py-2.5 font-medium text-gray-700 hover:border-indigo-400 focus:border-indigo-500 focus:outline-none transition"
>
{yearOptions.map((year) => (
<option key={year} value={year}>
{year}
</option>
))}
</select>
</div>


      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">Período</label>
        <select
          value={selectedQuarter}
          onChange={(e) => setSelectedQuarter(e.target.value)}
          className="border-2 border-gray-200 rounded-lg px-4 py-2.5 font-medium text-gray-700 hover:border-indigo-400 focus:border-indigo-500 focus:outline-none transition"
        >
          <option value="full">Año completo</option>
          <option value="q1">Q1 (Ene-Mar)</option>
          <option value="q2">Q2 (Abr-Jun)</option>
          <option value="q3">Q3 (Jul-Sep)</option>
          <option value="q4">Q4 (Oct-Dic)</option>
        </select>
      </div>
    </div>
  </div>

  {overdueInvoices.length > 0 && (
    <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 rounded-xl p-5 flex gap-4">
      <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={24} />
      <div className="flex-1">
        <p className="font-bold text-red-900 mb-1">⚠️ Facturas Vencidas</p>
        <p className="text-sm text-red-800">
          Tienes <span className="font-semibold">{overdueInvoices.length}</span> factura(s) vencida(s) por cobrar. 
          Total pendiente: <span className="font-semibold">{formatCurrency(overdueInvoices.reduce((sum, inv) => sum + inv.total, 0))}</span>
        </p>
      </div>
    </div>
  )}

  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-6 shadow-md hover:shadow-lg transition border border-indigo-200">
      <div className="flex items-center justify-between mb-3">
        <p className="text-indigo-700 text-sm font-semibold">Ingresos Totales</p>
        <TrendingUp className="text-indigo-600" size={20} />
      </div>
      <p className="text-3xl font-bold text-indigo-900 mb-2">{formatCurrency(totalIncome)}</p>
      <p className="text-xs text-indigo-600 font-medium">
        IVA: {formatCurrency(totalInvoiceVAT)}
      </p>
    </div>

    <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 shadow-md hover:shadow-lg transition border border-red-200">
      <div className="flex items-center justify-between mb-3">
        <p className="text-red-700 text-sm font-semibold">Gastos Totales</p>
        <TrendingDown className="text-red-600" size={20} />
      </div>
      <p className="text-3xl font-bold text-red-900 mb-2">{formatCurrency(totalOut)}</p>
      <p className="text-xs text-red-600 font-medium">
        IVA soportado: {formatCurrency(totalInputVAT)}
      </p>
    </div>

    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-6 shadow-md hover:shadow-lg transition border border-emerald-200">
      <div className="flex items-center justify-between mb-3">
        <p className="text-emerald-700 text-sm font-semibold">Resultado Operativo</p>
        <BarChart3 className="text-emerald-600" size={20} />
      </div>
      <p className="text-3xl font-bold text-emerald-900 mb-2">{formatCurrency(operationalResult)}</p>
      <p className="text-xs text-emerald-600 font-medium">
        Neto: {formatCurrency(netAfterVAT)}
      </p>
    </div>

    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 shadow-md hover:shadow-lg transition border border-purple-200">
      <div className="flex items-center justify-between mb-3">
        <p className="text-purple-700 text-sm font-semibold">IVA a Declarar</p>
        <DollarSign className="text-purple-600" size={20} />
      </div>
      <p className="text-3xl font-bold text-purple-900 mb-2">{formatCurrency(vatToDeclare)}</p>
      <p className="text-xs text-purple-600 font-medium">
        {filteredInvoices.length} factura(s)
      </p>
    </div>
  </div>

  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="text-indigo-600" size={24} />
        <h3 className="font-bold text-lg text-gray-800">Ingresos, Gastos y Beneficio</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">Evolución mensual del período seleccionado</p>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={monthlyData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" stroke="#6b7280" />
          <YAxis stroke="#6b7280" />
          <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Bar dataKey="ingresos" fill="#4f46e5" radius={[4, 4, 0, 0]} />
          <Bar dataKey="gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
          <Bar dataKey="beneficio" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>

    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="text-purple-600" size={24} />
        <h3 className="font-bold text-lg text-gray-800">Estado de Facturas</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">Resumen del estado de facturación</p>
      {invoiceStatusData.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No hay datos en este período.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={invoiceStatusData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={45}
                dataKey="value"
                labelLine={false}
              >
                {invoiceStatusData.map((entry, index) => (
                  <Cell key={`status-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value} facturas`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {invoiceStatusData.map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.fill }}
                />
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-700">{item.name}</p>
                  <p className="text-sm font-bold text-gray-900">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>

    <div className="bg-white rounded-lg shadow p-6 xl:col-span-2">
      <h3 className="font-bold text-lg mb-4">Resumen de tesorería (12 meses)</h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={treasuryData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(value) => formatCurrency(value)} />
          <Legend />
          <Line type="monotone" dataKey="entradas" stroke="#2563eb" strokeWidth={2} />
          <Line type="monotone" dataKey="salidas" stroke="#ef4444" strokeWidth={2} />
          <Line type="monotone" dataKey="neto" stroke="#10b981" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>

    {topClients.length > 0 && (
      <div className="bg-white rounded-lg shadow p-6 xl:col-span-2">
        <h3 className="font-bold text-lg mb-4">Mejores clientes</h3>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={topClients}
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={50}
              dataKey="value"
              labelLine={false}
            >
              {topClients.map((entry, index) => (
                <Cell
                  key={`client-${index}`}
                  fill={CLIENT_COLORS[index % CLIENT_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value) => formatCurrency(value)}
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {topClients.map((client, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition">
              <div 
                className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                style={{ backgroundColor: CLIENT_COLORS[index % CLIENT_COLORS.length] }}
              />
              <span className="truncate font-medium text-gray-700">{client.name}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>

  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-bold text-lg mb-4">Últimas facturas emitidas</h3>
      <div className="space-y-3">
        {recentInvoices.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay facturas en este período.</p>
        ) : (
          recentInvoices.map((invoice) => {
            const client = clients.find((c) => c.id === invoice.clientId);
            const status = getEffectiveInvoiceStatus(invoice);

            return (
              <div key={invoice.id} className="flex items-center justify-between border-b pb-2">
                <div>
                  <p className="font-medium">{invoice.invoiceNumber}</p>
                  <p className="text-sm text-gray-500">
                    {client?.commercialName || client?.fiscalName || 'Cliente'} ·{' '}
                    {formatDate(invoice.issueDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(invoice.total)}</p>
                  <p
                    className={`text-xs inline-block px-2 py-1 rounded-full ${getInvoiceStatusClass(
                      status
                    )}`}
                  >
                    {getInvoiceStatusLabel(status)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>

    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-bold text-lg mb-4">Últimos gastos / facturas recibidas</h3>
      <div className="space-y-3">
        {recentOutgoing.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay movimientos en este período.</p>
        ) : (
          recentOutgoing.map((item) => (
            <div key={item.id} className="flex items-center justify-between border-b pb-2">
              <div>
                <p className="font-medium">{item.concept || item.description}</p>
                <p className="text-sm text-gray-500">
                  {item.issuerName || item.category} · {formatDate(item.issueDate)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(item.total)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  </div>
</div>


);
}

function InvoicesPage({
invoices,
clients,
onGoCreate,
onDelete,
onMarkAsPaid,
onMarkAsUnpaid,
onMarkAsSent,
}) {
const [searchTerm, setSearchTerm] = useState('');
const [previewInvoice, setPreviewInvoice] = useState(null);

const sortedInvoices = useMemo(() => sortByDateDesc(invoices, ['issueDate']), [invoices]);

const filteredInvoices = useMemo(() => {
if (!searchTerm.trim()) return sortedInvoices;


const term = searchTerm.toLowerCase();

return sortedInvoices.filter((invoice) => {
  const client = clients.find((c) => c.id === invoice.clientId);
  const clientName = client?.commercialName || client?.fiscalName || '';

  return (
    (invoice.invoiceNumber || '').toLowerCase().includes(term) ||
    clientName.toLowerCase().includes(term) ||
    (invoice.orderNumber || '').toLowerCase().includes(term)
  );
});


}, [sortedInvoices, searchTerm, clients]);

return (
<div className="space-y-6">
<div className="flex justify-between items-center gap-4 flex-wrap">
<h2 className="text-2xl font-bold">Facturas emitidas</h2>
<button
onClick={onGoCreate}
className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
>
<Plus size={18} /> Nueva factura
</button>
</div>


  <div className="bg-white rounded-lg shadow p-4">
    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
      <Search size={20} className="text-gray-400" />
      <input
        type="text"
        placeholder="Buscar por número, cliente u orden de compra..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="flex-1 bg-gray-50 outline-none text-sm"
      />
      {searchTerm && (
        <button
          onClick={() => setSearchTerm('')}
          className="text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>
      )}
    </div>
  </div>

  <div className="bg-white rounded-lg shadow overflow-y-auto max-h-[600px]">
    <div className="divide-y">
      {filteredInvoices.length === 0 ? (
        <div className="px-4 py-6 text-center text-gray-500 text-sm">
          {searchTerm ? 'No se encontraron resultados.' : 'No hay facturas todavía.'}
        </div>
      ) : (
        filteredInvoices.map((invoice) => {
          const client = clients.find((c) => c.id === invoice.clientId);
          const effectiveStatus = getEffectiveInvoiceStatus(invoice);

          return (
            <div key={invoice.id} className="px-4 py-3 hover:bg-gray-50 transition flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono font-semibold text-blue-600 text-xs">{invoice.invoiceNumber}</span>
                  <span className="text-xs text-gray-600 truncate">
                    {client?.commercialName || client?.fiscalName || 'Cliente desconocido'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${getInvoiceStatusClass(
                      effectiveStatus
                    )}`}
                  >
                    {getInvoiceStatusLabel(effectiveStatus)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                  <span>Emisión: {formatDate(invoice.issueDate)}</span>
                  <span>Vencimiento: {invoice.dueDate ? formatDate(invoice.dueDate) : 'Sin vto.'}</span>
                  {invoice.orderNumber && <span>OC: {invoice.orderNumber}</span>}
                  <span className="font-semibold text-gray-900">{formatCurrency(invoice.total)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1 flex-shrink-0 ml-2">
                <button
                  onClick={() => setPreviewInvoice(invoice)}
                  className="text-blue-600 hover:text-blue-800 transition p-1"
                  title="Ver PDF"
                >
                  <Eye size={16} />
                </button>

                {invoice.status === 'draft' && (
                  <button
                    onClick={() => onMarkAsSent(invoice.id)}
                    className="text-blue-600 hover:text-blue-800 transition p-1"
                    title="Emitir factura"
                  >
                    <Send size={16} />
                  </button>
                )}

                {effectiveStatus !== 'paid' && invoice.status !== 'draft' && (
                  <button
                    onClick={() => onMarkAsPaid(invoice.id)}
                    className="text-gray-400 hover:text-green-600 transition p-1"
                    title="Marcar como pagada"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                )}

                {effectiveStatus === 'paid' && (
                  <button
                    onClick={() => onMarkAsUnpaid(invoice.id)}
                    className="text-green-600 hover:text-red-600 transition p-1"
                    title="Desmarcar como pagada"
                  >
                    <XCircle size={16} />
                  </button>
                )}

                <button
                  onClick={() => onDelete(invoice.id)}
                  className="text-red-600 hover:text-red-800 transition p-1"
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  </div>

  {filteredInvoices.length > 0 && (
    <p className="text-sm text-gray-500 text-center">
      Mostrando {filteredInvoices.length} de {sortedInvoices.length} facturas
    </p>
  )}

  {/* MODAL DE PREVIEW DE FACTURA - FULLSCREEN */}
  {previewInvoice && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white rounded-none md:rounded-lg shadow-lg w-full h-full md:max-h-[90vh] md:max-w-4xl overflow-y-auto flex flex-col">
        {/* Encabezado del modal */}
        <div className="sticky top-0 bg-gray-50 px-4 md:px-8 py-3 md:py-4 flex justify-between items-center border-b flex-shrink-0">
          <h3 className="text-lg md:text-xl font-bold truncate">Factura {previewInvoice.invoiceNumber}</h3>
          <button
            onClick={() => setPreviewInvoice(null)}
            className="text-gray-500 hover:text-gray-700 ml-4 flex-shrink-0"
          >
            <X size={24} />
          </button>
        </div>

        {/* Contenido PDF - Scrolleable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-white">
          {/* Membrete */}
          <div className="border-b-2 pb-4 md:pb-6 mb-4 md:mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-blue-600">{COMPANY.legalName}</h1>
            <p className="text-gray-600 text-xs md:text-sm mt-1 md:mt-2">CIF: {COMPANY.taxId}</p>
            <p className="text-gray-600 text-xs md:text-sm">{COMPANY.address}</p>
          </div>

          {/* Título de factura */}
          <div className="mb-6 md:mb-8">
            <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4">FACTURA</h2>
            <div className="grid grid-cols-2 gap-4 md:gap-8">
              <div>
                <p className="text-xs md:text-sm font-semibold text-gray-600">Número de factura</p>
                <p className="text-sm md:text-lg font-mono font-bold">{previewInvoice.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm font-semibold text-gray-600">Fecha de emisión</p>
                <p className="text-sm md:text-lg font-bold">{formatDate(previewInvoice.issueDate)}</p>
              </div>
            </div>
          </div>

          {/* Datos del cliente */}
          <div className="mb-6 md:mb-8 p-3 md:p-4 bg-gray-50 rounded-lg">
            <p className="text-xs md:text-sm font-semibold text-gray-600 mb-2">CLIENTE</p>
            {(() => {
              const client = clients.find((c) => c.id === previewInvoice.clientId);
              return (
                <>
                  <p className="font-bold text-sm md:text-base">{client?.commercialName || client?.fiscalName}</p>
                  {client?.cif&& <p className="text-xs md:text-sm text-gray-600">CIF/NIF: {client.taxId}</p>}
                  {client?.address && <p className="text-xs md:text-sm text-gray-600">{client.address}</p>}
                  {client?.postalCode && client?.city && (
                    <p className="text-xs md:text-sm text-gray-600">{client.postalCode} {client.city}</p>
                  )}
                </>
              );
            })()}
          </div>

          {/* Conceptos */}
          <div className="mb-6 md:mb-8 overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 text-xs md:text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 md:px-4 py-2 text-left font-semibold">Concepto</th>
                  <th className="border border-gray-300 px-2 md:px-4 py-2 text-center font-semibold">Cant.</th>
                  <th className="border border-gray-300 px-2 md:px-4 py-2 text-right font-semibold">Monto</th>
                  <th className="border border-gray-300 px-2 md:px-4 py-2 text-center font-semibold">IVA</th>
                  <th className="border border-gray-300 px-2 md:px-4 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {previewInvoice.items.map((item, idx) => {
                  const quantity = Number(item.quantity || 1);
                  const baseAmount = Number(item.baseAmount || 0);
                  const tax = Number(item.tax || 0);
                  const lineBase = baseAmount * quantity;
                  const taxAmount = lineBase * (tax / 100);
                  const lineTotal = lineBase + taxAmount;

                  return (
                    <tr key={idx}>
                      <td className="border border-gray-300 px-2 md:px-4 py-2">{item.description}</td>
                      <td className="border border-gray-300 px-2 md:px-4 py-2 text-center">{quantity}</td>
                      <td className="border border-gray-300 px-2 md:px-4 py-2 text-right">{baseAmount.toFixed(2)}</td>
                      <td className="border border-gray-300 px-2 md:px-4 py-2 text-center">{tax}%</td>
                      <td className="border border-gray-300 px-2 md:px-4 py-2 text-right font-semibold">{lineTotal.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Resumen de totales */}
          <div className="flex justify-end mb-6 md:mb-8">
            <div className="w-64 md:w-80">
              <div className="border border-gray-300 p-3 md:p-4 rounded-lg space-y-2 md:space-y-3 text-xs md:text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold">Subtotal:</span>
                  <span>{formatCurrency(previewInvoice.subtotal)}</span>
                </div>
                {previewInvoice.totalTax > 0 && (
                  <div className="flex justify-between">
                    <span className="font-semibold">IVA:</span>
                    <span>{formatCurrency(previewInvoice.totalTax)}</span>
                  </div>
                )}
                {previewInvoice.retentionAmount > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span className="font-semibold">Retención IRPF ({previewInvoice.retentionPercentage}%):</span>
                    <span>-{formatCurrency(previewInvoice.retentionAmount)}</span>
                  </div>
                )}
                <div className="border-t-2 pt-2 md:pt-3 flex justify-between text-base md:text-lg font-bold">
                  <span>TOTAL:</span>
                  <span className="text-blue-600">{formatCurrency(previewInvoice.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Información adicional */}
          {previewInvoice.dueDate && (
            <div className="mb-4 md:mb-8 p-3 md:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs md:text-sm"><span className="font-semibold">Fecha de vencimiento:</span> {formatDate(previewInvoice.dueDate)}</p>
            </div>
          )}

          {previewInvoice.orderNumber && (
            <div className="mb-4 md:mb-8 p-3 md:p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs md:text-sm"><span className="font-semibold">Orden de compra:</span> {previewInvoice.orderNumber}</p>
            </div>
          )}

          {previewInvoice.visibleNotes && (
            <div className="mb-4 md:mb-8 p-3 md:p-4 bg-gray-50 rounded-lg">
              <p className="text-xs md:text-sm font-semibold mb-2">Notas:</p>
              <p className="text-xs md:text-sm whitespace-pre-wrap">{previewInvoice.notes}</p>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="sticky bottom-0 bg-gray-50 px-4 md:px-8 py-3 md:py-4 border-t flex justify-end gap-2 flex-shrink-0 flex-wrap">
          <button
            onClick={() => window.print()}
            className="bg-blue-600 text-white px-4 md:px-6 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm md:text-base"
          >
            <Download size={16} /> Descargar/Imprimir
          </button>
          <button
            onClick={() => setPreviewInvoice(null)}
            className="bg-gray-300 text-gray-700 px-4 md:px-6 py-2 rounded-lg hover:bg-gray-400 transition text-sm md:text-base"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )}
</div>


);
}

function CreateInvoicePage({ clients, onCreateInvoice, onCancel }) {
const [form, setForm] = useState(getDefaultInvoiceForm());
const [validationErrors, setValidationErrors] = useState({});

const liveTotals = useMemo(
() =>
calculateInvoiceTotals(
form.items.filter((item) => item.description.trim() !== ''),
form.retentionPercentage
),
[form]
);

const selectedClient = clients.find((c) => c.id === form.clientId);
const autoRetention = selectedClient?.clientType === 'professional' ? 15 : 0;

const updateItem = (index, field, value) => {
const updated = [...form.items];
updated[index] = { ...updated[index], [field]: value };
setForm({ ...form, items: updated });
};

const removeItem = (index) => {
if (form.items.length === 1) return;
const updated = form.items.filter((_, i) => i !== index);
setForm({ ...form, items: updated });
};

const validateForm = () => {
const errors = {};


if (!form.clientId) {
  errors.clientId = 'Selecciona un cliente.';
}

// ✅ MEJORA 1: Validar que dueDate > issueDate (solo si hay dueDate)
if (form.dueDate && new Date(form.dueDate) <= new Date(form.issueDate)) {
  errors.dueDate = 'La fecha de vencimiento debe ser posterior a la emisión.';
}

const validItems = form.items.filter(
  (item) =>
    item.description.trim() !== '' &&
    Number(item.baseAmount) > 0
);

if (validItems.length === 0) {
  errors.items = 'Añade al menos un concepto válido con monto > 0.';
}

setValidationErrors(errors);
return Object.keys(errors).length === 0;


};

const submit = (status) => {
if (!validateForm()) return;


const ok = onCreateInvoice(form, status);
if (ok) {
  setForm(getDefaultInvoiceForm());
  setValidationErrors({});
}


};

return (
<div className="max-w-6xl mx-auto bg-white rounded-lg shadow p-6 space-y-6">
<div className="flex items-center justify-between gap-4 flex-wrap">
<h2 className="text-2xl font-bold">Nueva factura emitida</h2>
<button
onClick={onCancel}
className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
>
Volver
</button>
</div>


  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
    <div>
      <label className="block text-sm font-medium mb-2">Cliente *</label>
      <select
        value={form.clientId}
        onChange={(e) => {
          const clientId = e.target.value;
          const client = clients.find((c) => c.id === clientId);
          const retention = client?.clientType === 'professional' ? 15 : 0;

          setForm({
            ...form,
            clientId,
            retentionPercentage: retention,
          });
        }}
        className={`w-full border rounded-lg px-3 py-2 ${
          validationErrors.clientId ? 'border-red-500' : ''
        }`}
      >
        <option value="">Selecciona un cliente</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.commercialName || client.fiscalName}
          </option>
        ))}
      </select>
      {validationErrors.clientId && (
        <p className="text-red-600 text-xs mt-1">{validationErrors.clientId}</p>
      )}
    </div>

    <div>
      <label className="block text-sm font-medium mb-2">Fecha emisión</label>
      <input
        type="date"
        value={form.issueDate}
        onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
        className="w-full border rounded-lg px-3 py-2"
      />
    </div>

    <div>
      <label className="block text-sm font-medium mb-2">Vencimiento</label>
      <div className="flex items-center gap-3 mb-2">
        <input
          type="checkbox"
          id="noLimitDate"
          checked={!form.dueDate}
          onChange={(e) => {
            if (e.target.checked) {
              setForm({ ...form, dueDate: '' });
            } else {
              setForm({ ...form, dueDate: addDaysToDateString(form.issueDate, 30) });
            }
          }}
          className="w-4 h-4 cursor-pointer"
        />
        <label htmlFor="noLimitDate" className="text-sm text-gray-600 cursor-pointer">
          Sin fecha de vencimiento
        </label>
      </div>
      {form.dueDate && (
        <input
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          className={`w-full border rounded-lg px-3 py-2 ${
            validationErrors.dueDate ? 'border-red-500' : ''
          }`}
        />
      )}
      {validationErrors.dueDate && (
        <p className="text-red-600 text-xs mt-1">{validationErrors.dueDate}</p>
      )}
    </div>

    <div>
      <label className="block text-sm font-medium mb-2">Orden de compra</label>
      <input
        type="text"
        value={form.orderNumber}
        onChange={(e) => setForm({ ...form, orderNumber: e.target.value })}
        placeholder="PO / OC / referencia cliente"
        className="w-full border rounded-lg px-3 py-2"
      />
    </div>
  </div>

  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
    <div>
      <label className="block text-sm font-medium mb-2">Retención</label>
      <div className="flex gap-2">
        <select
          value={form.retentionPercentage}
          onChange={(e) =>
            setForm({ ...form, retentionPercentage: Number(e.target.value) })
          }
          className="flex-1 border rounded-lg px-3 py-2"
        >
          <option value={0}>0% (Empresa)</option>
          <option value={15}>15% (Profesional)</option>
        </select>
        {selectedClient && form.retentionPercentage !== autoRetention && (
          <button
            onClick={() =>
              setForm({ ...form, retentionPercentage: autoRetention })
            }
            className="text-xs bg-blue-50 text-blue-600 px-2 py-2 rounded hover:bg-blue-100 transition"
            title="Aplicar retención según tipo de cliente"
          >
            Auto
          </button>
        )}
      </div>
      {selectedClient && (
        <p className="text-xs text-gray-500 mt-1">
          Cliente:{' '}
          {selectedClient.clientType === 'professional'
            ? 'Profesional (15%)'
            : 'Empresa (0%)'}
        </p>
      )}
    </div>

    <div className="xl:col-span-2">
      <label className="block text-sm font-medium mb-2">Notas visibles en factura</label>
      <input
        type="text"
        value={form.visibleNotes}
        onChange={(e) => setForm({ ...form, visibleNotes: e.target.value })}
        placeholder="Texto visible en PDF o factura"
        className="w-full border rounded-lg px-3 py-2"
      />
    </div>

    <div className="xl:col-span-3">
      <label className="block text-sm font-medium mb-2">Notas internas</label>
      <textarea
        value={form.internalNotes}
        onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
        placeholder="Notas internas no visibles para el cliente"
        className="w-full border rounded-lg px-3 py-2 min-h-[100px]"
      />
    </div>
  </div>

  <div>
    <h3 className="font-semibold mb-4">Conceptos</h3>

    <div className="hidden lg:grid lg:grid-cols-5 gap-2 mb-2 text-sm font-medium text-gray-600">
      <div className="col-span-2">Descripción</div>
      <div className="text-center">Cantidad</div>
      <div className="text-right">Monto (€)</div>
      <div className="text-center">IVA</div>
    </div>

    <div className="space-y-3">
      {form.items.map((item, index) => (
        <div
          key={index}
          className="grid grid-cols-1 lg:grid-cols-5 gap-2 border rounded-lg p-3 lg:border-0 lg:p-0"
        >
          <div className="lg:col-span-2">
            <input
              type="text"
              placeholder="Descripción del concepto"
              value={item.description}
              onChange={(e) => updateItem(index, 'description', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-col">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ej: 1, 2, 5, 10"
              value={item.quantity}
              onChange={(e) => {
                const value = e.target.value;
                // Solo permitir números positivos
                if (value === '') {
                  updateItem(index, 'quantity', 0);
                } else if (/^\d+$/.test(value)) {
                  updateItem(index, 'quantity', Number(value));
                }
              }}
              className="w-full border rounded px-3 py-2 text-sm text-center"
              title="Cantidad de unidades"
            />
            <label className="text-xs text-gray-500 text-center mt-1 italic">Cantidad</label>
          </div>

          <div className="flex flex-col">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Ej: 100, 1500.50"
              value={item.baseAmount}
              onChange={(e) => {
                const value = e.target.value;
                // Solo permitir números y un punto decimal
                if (value === '') {
                  updateItem(index, 'baseAmount', 0);
                } else if (/^\d*\.?\d*$/.test(value)) {
                  const numValue = Number(value);
                  if (!isNaN(numValue)) {
                    updateItem(index, 'baseAmount', Math.max(0, numValue));
                  }
                }
              }}
              className="w-full border rounded px-3 py-2 text-sm text-right"
              title="Monto unitario en euros"
            />
            <label className="text-xs text-gray-500 text-right mt-1 italic">Monto (€)</label>
          </div>

          <div className="flex flex-col">
            <select
              value={item.tax}
              onChange={(e) => updateItem(index, 'tax', Number(e.target.value))}
              className="w-full border rounded px-3 py-2 text-sm"
              title="Impuesto sobre el valor añadido"
            >
              <option value={0}>0%</option>
              <option value={10}>10%</option>
              <option value={21}>21%</option>
            </select>
            <label className="text-xs text-gray-500 text-center mt-1 italic">IVA</label>
          </div>

          <button
            type="button"
            onClick={() => removeItem(index)}
            className="lg:col-span-5 border rounded px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition font-medium"
          >
            ✕ Eliminar concepto
          </button>
        </div>
      ))}
    </div>

    {validationErrors.items && (
      <p className="text-red-600 text-sm mt-2">{validationErrors.items}</p>
    )}

    <button
      onClick={() =>
        setForm({
          ...form,
          items: [...form.items, { ...EMPTY_INVOICE_ITEM }],
        })
      }
      className="text-blue-600 text-sm font-medium mt-3 hover:text-blue-700"
    >
      + Añadir concepto
    </button>
  </div>

  <div className="bg-gray-50 rounded-lg p-4">
    <h3 className="font-semibold mb-3">Resumen</h3>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
      <div>
        <p className="text-gray-500">Subtotal</p>
        <p className="font-semibold">{formatCurrency(liveTotals.subtotal)}</p>
      </div>
      <div>
        <p className="text-gray-500">IVA</p>
        <p className="font-semibold">{formatCurrency(liveTotals.totalTax)}</p>
      </div>
      <div>
        <p className="text-gray-500">Retención</p>
        <p className="font-semibold">{formatCurrency(liveTotals.retentionAmount)}</p>
      </div>
      <div>
        <p className="text-gray-500">Total</p>
        <p className="font-semibold">{formatCurrency(liveTotals.total)}</p>
      </div>
    </div>
  </div>

  <div className="flex gap-4 flex-wrap">
    <button
      onClick={() => submit('draft')}
      className="bg-gray-700 text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition"
    >
      Guardar borrador
    </button>

    <button
      onClick={() => submit('sent')}
      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
    >
      Emitir factura
    </button>

    <button
      onClick={onCancel}
      className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition"
    >
      Cancelar
    </button>
  </div>
</div>


);
}

function PurchaseInvoicesPage({ purchaseInvoices, onAddPurchaseInvoice, onDelete, onMarkPaid, onMarkUnpaid }) {
const [showForm, setShowForm] = useState(false);
const [form, setForm] = useState(getDefaultPurchaseInvoiceForm());
const [searchTerm, setSearchTerm] = useState('');
const [validationErrors, setValidationErrors] = useState({});

const liveTotals = useMemo(
() =>
calculatePurchaseOrExpenseTotals({
taxableBase: form.taxableBase,
taxPercentage: form.taxPercentage,
withholdingPercentage: form.withholdingPercentage,
}),
[form]
);

const handleSubmit = () => {
const errors = {};


if (!form.issuerName.trim()) {
  errors.issuerName = 'El emisor es obligatorio.';
}

if (!form.concept.trim()) {
  errors.concept = 'El concepto es obligatorio.';
}

if (Number(form.taxableBase) <= 0) {
  errors.taxableBase = 'La base imponible debe ser mayor a 0.';
}

setValidationErrors(errors);
if (Object.keys(errors).length > 0) return;

const effectivePaymentDate =
  form.paymentStatus === 'paid' ? form.paymentDate || getToday() : form.paymentDate;

onAddPurchaseInvoice({
  ...form,
  paymentDate: effectivePaymentDate,
  issuerName: form.issuerName.trim(),
  issuerTaxId: form.issuerTaxId.trim(),
  concept: form.concept.trim(),
  notes: form.notes.trim(),
  ...liveTotals,
});

setForm(getDefaultPurchaseInvoiceForm());
setShowForm(false);
setValidationErrors({});


};

const sorted = useMemo(() => sortByDateDesc(purchaseInvoices, ['issueDate']), [purchaseInvoices]);

const filtered = useMemo(() => {
if (!searchTerm.trim()) return sorted;
const term = searchTerm.toLowerCase();
return sorted.filter(
(item) =>
(item.issuerName || '').toLowerCase().includes(term) ||
(item.concept || '').toLowerCase().includes(term)
);
}, [sorted, searchTerm]);

return (
<div className="space-y-6">
<div className="flex justify-between items-center gap-4 flex-wrap">
<h2 className="text-2xl font-bold">Facturas recibidas</h2>
<button
onClick={() => setShowForm(!showForm)}
className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
>
<Plus size={18} /> Nueva factura recibida
</button>
</div>


  {showForm && (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <h3 className="font-bold text-lg">Registrar factura recibida</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div>
          <input
            type="text"
            placeholder="Emisor *"
            value={form.issuerName}
            onChange={(e) => setForm({ ...form, issuerName: e.target.value })}
            className={`w-full border rounded px-3 py-2 ${
              validationErrors.issuerName ? 'border-red-500' : ''
            }`}
          />
          {validationErrors.issuerName && (
            <p className="text-red-600 text-xs mt-1">{validationErrors.issuerName}</p>
          )}
        </div>

        <input
          type="text"
          placeholder="CIF/NIF emisor"
          value={form.issuerTaxId}
          onChange={(e) => setForm({ ...form, issuerTaxId: e.target.value })}
          className="border rounded px-3 py-2"
        />

        <input
          type="date"
          value={form.issueDate}
          onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
          className="border rounded px-3 py-2"
        />

        <input
          type="date"
          value={form.paymentDate}
          onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
          className="border rounded px-3 py-2"
        />

        <div className="md:col-span-2">
          <input
            type="text"
            placeholder="Concepto *"
            value={form.concept}
            onChange={(e) => setForm({ ...form, concept: e.target.value })}
            className={`w-full border rounded px-3 py-2 ${
              validationErrors.concept ? 'border-red-500' : ''
            }`}
          />
          {validationErrors.concept && (
            <p className="text-red-600 text-xs mt-1">{validationErrors.concept}</p>
          )}
        </div>

        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="border rounded px-3 py-2"
        >
          <option value="general">General</option>
          <option value="software">Software</option>
          <option value="studio">Estudio</option>
          <option value="travel">Viaje</option>
          <option value="supplies">Suministros</option>
        </select>

        <select
          value={form.paymentStatus}
          onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}
          className="border rounded px-3 py-2"
        >
          <option value="pending">Pendiente</option>
          <option value="paid">Pagada</option>
        </select>

        <div>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Base imponible"
            value={form.taxableBase}
            onChange={(e) =>
              setForm({ ...form, taxableBase: Math.max(0, Number(e.target.value) || 0) })
            }
            className={`w-full border rounded px-3 py-2 ${
              validationErrors.taxableBase ? 'border-red-500' : ''
            }`}
          />
          {validationErrors.taxableBase && (
            <p className="text-red-600 text-xs mt-1">{validationErrors.taxableBase}</p>
          )}
        </div>

        <select
          value={form.taxPercentage}
          onChange={(e) => setForm({ ...form, taxPercentage: Number(e.target.value) })}
          className="border rounded px-3 py-2"
        >
          <option value={0}>IVA 0% (Exento)</option>
          <option value={4}>IVA 4% (Reducido)</option>
          <option value={10}>IVA 10% (Reducido)</option>
          <option value={21}>IVA 21% (Estándar)</option>
        </select>

        <select
          value={form.withholdingPercentage}
          onChange={(e) =>
            setForm({ ...form, withholdingPercentage: Number(e.target.value) })
          }
          className="border rounded px-3 py-2"
        >
          <option value={0}>Retención 0%</option>
          <option value={1}>Retención 1%</option>
          <option value={1.75}>Retención 1.75%</option>
          <option value={2}>Retención 2%</option>
          <option value={3}>Retención 3%</option>
          <option value={5}>Retención 5%</option>
          <option value={15}>Retención 15%</option>
          <option value={19}>Retención 19%</option>
          <option value={21}>Retención 21%</option>
        </select>

        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) =>
            setForm({
              ...form,
              attachmentName: e.target.files?.[0]?.name || '',
            })
          }
          className="border rounded px-3 py-2"
        />
      </div>

      <textarea
        placeholder="Notas"
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
        className="w-full border rounded px-3 py-2 min-h-[90px]"
      />

      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Base</p>
            <p className="font-semibold">{formatCurrency(liveTotals.taxableBase)}</p>
          </div>
          <div>
            <p className="text-gray-500">IVA</p>
            <p className="font-semibold">{formatCurrency(liveTotals.taxAmount)}</p>
          </div>
          <div>
            <p className="text-gray-500">Retención</p>
            <p className="font-semibold">{formatCurrency(liveTotals.withholdingAmount)}</p>
          </div>
          <div>
            <p className="text-gray-500">Total</p>
            <p className="font-semibold">{formatCurrency(liveTotals.total)}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={handleSubmit}
          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
        >
          Guardar factura recibida
        </button>
        <button
          onClick={() => {
            setShowForm(false);
            setValidationErrors({});
          }}
          className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition"
        >
          Cancelar
        </button>
      </div>
    </div>
  )}

  <div className="bg-white rounded-lg shadow p-4">
    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
      <Search size={20} className="text-gray-400" />
      <input
        type="text"
        placeholder="Buscar por emisor o concepto..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="flex-1 bg-gray-50 outline-none text-sm"
      />
      {searchTerm && (
        <button
          onClick={() => setSearchTerm('')}
          className="text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>
      )}
    </div>
  </div>

  <div className="bg-white rounded-lg shadow overflow-y-auto max-h-[600px]">
    <div className="divide-y">
      {filtered.length === 0 ? (
        <div className="px-4 py-6 text-center text-gray-500 text-sm">
          {searchTerm ? 'No se encontraron resultados.' : 'No hay facturas recibidas todavía.'}
        </div>
      ) : (
        filtered.map((item) => (
          <div key={item.id} className="px-4 py-3 hover:bg-gray-50 transition flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-blue-600 text-xs">{item.issuerName}</span>
                <span className="text-xs text-gray-600 truncate">{item.concept}</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                    item.paymentStatus === 'paid'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {item.paymentStatus === 'paid' ? 'Pagada' : 'Pendiente'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                <span>Fecha: {formatDate(item.issueDate)}</span>
                <span className="font-semibold text-gray-900">{formatCurrency(item.total)}</span>
                {item.attachmentName && (
                  <span className="flex items-center gap-1">
                    <FileText size={12} /> {item.attachmentName}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-1 flex-shrink-0 ml-2">
              {item.paymentStatus !== 'paid' && (
                <button
                  onClick={() => onMarkPaid(item.id)}
                  className="text-gray-400 hover:text-green-600 transition p-1"
                  title="Marcar pagada"
                >
                  <CheckCircle2 size={16} />
                </button>
              )}
              {item.paymentStatus === 'paid' && (
                <button
                  onClick={() => onMarkUnpaid(item.id)}
                  className="text-green-600 hover:text-red-600 transition p-1"
                  title="Desmarcar como pagada"
                >
                  <XCircle size={16} />
                </button>
              )}
              <button
                onClick={() => onDelete(item.id)}
                className="text-red-600 hover:text-red-800 transition p-1"
                title="Eliminar"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  </div>

  {filtered.length > 0 && (
    <p className="text-sm text-gray-500 text-center">
      Mostrando {filtered.length} de {sorted.length} facturas recibidas
    </p>
  )}
</div>


);
}

function ExpensesPage({ expenses, onAddExpense, onDeleteExpense }) {
const [showForm, setShowForm] = useState(false);
const [form, setForm] = useState(getDefaultExpenseForm());
const [searchTerm, setSearchTerm] = useState('');
const [validationErrors, setValidationErrors] = useState({});

const liveTotals = useMemo(
() =>
calculatePurchaseOrExpenseTotals({
taxableBase: form.taxableBase,
taxPercentage: form.taxPercentage,
withholdingPercentage: 0,
}),
[form]
);

const handleSubmit = () => {
const errors = {};


if (!form.description.trim()) {
  errors.description = 'La descripción es obligatoria.';
}

if (Number(form.taxableBase) <= 0) {
  errors.taxableBase = 'La base imponible debe ser mayor a 0.';
}

// ✅ MEJORA 4: Validar que fecha de pago <= hoy
if (form.paymentDate && new Date(form.paymentDate) > new Date(getToday())) {
  errors.paymentDate = 'La fecha de pago no puede ser futura.';
}

setValidationErrors(errors);
if (Object.keys(errors).length > 0) return;

onAddExpense({
  ...form,
  description: form.description.trim(),
  notes: form.notes.trim(),
  ...liveTotals,
});

setForm(getDefaultExpenseForm());
setShowForm(false);
setValidationErrors({});


};

const sorted = useMemo(() => sortByDateDesc(expenses, ['issueDate']), [expenses]);

const filtered = useMemo(() => {
if (!searchTerm.trim()) return sorted;
const term = searchTerm.toLowerCase();
return sorted.filter((item) => (item.description || '').toLowerCase().includes(term));
}, [sorted, searchTerm]);

return (
<div className="space-y-6">
<div className="flex justify-between items-center gap-4 flex-wrap">
<h2 className="text-2xl font-bold">Gastos</h2>
<button
onClick={() => setShowForm(!showForm)}
className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
>
<Plus size={18} /> Nuevo gasto
</button>
</div>


  {showForm && (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <h3 className="font-bold text-lg">Registrar gasto</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div>
          <input
            type="text"
            placeholder="Descripción *"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={`w-full border rounded px-3 py-2 ${
              validationErrors.description ? 'border-red-500' : ''
            }`}
          />
          {validationErrors.description && (
            <p className="text-red-600 text-xs mt-1">{validationErrors.description}</p>
          )}
        </div>

        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="border rounded px-3 py-2"
        >
          <option value="general">General</option>
          <option value="office">Oficina</option>
          <option value="travel">Viaje</option>
          <option value="software">Software</option>
          <option value="supplies">Suministros</option>
          <option value="utilities">Servicios</option>
        </select>

        <input
          type="date"
          value={form.issueDate}
          onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
          className="border rounded px-3 py-2"
        />

        <input
          type="date"
          value={form.paymentDate}
          onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
          className={`border rounded px-3 py-2 ${
            validationErrors.paymentDate ? 'border-red-500' : ''
          }`}
        />
        {validationErrors.paymentDate && (
          <p className="text-red-600 text-xs mt-1">{validationErrors.paymentDate}</p>
        )}

        <div>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Base imponible"
            value={form.taxableBase}
            onChange={(e) =>
              setForm({ ...form, taxableBase: Math.max(0, Number(e.target.value) || 0) })
            }
            className={`w-full border rounded px-3 py-2 ${
              validationErrors.taxableBase ? 'border-red-500' : ''
            }`}
          />
          {validationErrors.taxableBase && (
            <p className="text-red-600 text-xs mt-1">{validationErrors.taxableBase}</p>
          )}
        </div>

        <select
          value={form.taxPercentage}
          onChange={(e) => setForm({ ...form, taxPercentage: Number(e.target.value) })}
          className="border rounded px-3 py-2"
        >
          <option value={0}>IVA 0% (Exento)</option>
          <option value={4}>IVA 4% (Reducido)</option>
          <option value={10}>IVA 10% (Reducido)</option>
          <option value={21}>IVA 21% (Estándar)</option>
        </select>

        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) =>
            setForm({
              ...form,
              receiptName: e.target.files?.[0]?.name || '',
              hasReceipt: Boolean(e.target.files?.[0]),
            })
          }
          className="border rounded px-3 py-2"
        />

        {/* ✅ MEJORA 5: Mejor UX para receiptName */}
        <input
          type="text"
          value={form.receiptName}
          readOnly
          placeholder="Sin archivo seleccionado"
          className="border rounded px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed"
          title="Se llena automáticamente al seleccionar un archivo"
        />
      </div>

      <textarea
        placeholder="Notas"
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
        className="w-full border rounded px-3 py-2 min-h-[90px]"
      />

      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Base</p>
            <p className="font-semibold">{formatCurrency(liveTotals.taxableBase)}</p>
          </div>
          <div>
            <p className="text-gray-500">IVA</p>
            <p className="font-semibold">{formatCurrency(liveTotals.taxAmount)}</p>
          </div>
          <div>
            <p className="text-gray-500">Retención</p>
            <p className="font-semibold">{formatCurrency(liveTotals.withholdingAmount)}</p>
          </div>
          <div>
            <p className="text-gray-500">Total</p>
            <p className="font-semibold">{formatCurrency(liveTotals.total)}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={handleSubmit}
          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
        >
          Guardar gasto
        </button>
        <button
          onClick={() => {
            setShowForm(false);
            setValidationErrors({});
          }}
          className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition"
        >
          Cancelar
        </button>
      </div>
    </div>
  )}

  <div className="bg-white rounded-lg shadow p-4">
    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
      <Search size={20} className="text-gray-400" />
      <input
        type="text"
        placeholder="Buscar gasto..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="flex-1 bg-gray-50 outline-none text-sm"
      />
      {searchTerm && (
        <button
          onClick={() => setSearchTerm('')}
          className="text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>
      )}
    </div>
  </div>

  <div className="bg-white rounded-lg shadow overflow-y-auto max-h-[600px]">
    <div className="divide-y">
      {filtered.length === 0 ? (
        <div className="px-4 py-6 text-center text-gray-500 text-sm">
          {searchTerm ? 'No se encontraron resultados.' : 'No hay gastos todavía.'}
        </div>
      ) : (
        filtered.map((expense) => (
          <div key={expense.id} className="px-4 py-3 hover:bg-gray-50 transition flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-blue-600 text-xs">{expense.description}</span>
                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">{expense.category}</span>
                {expense.hasReceipt && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <Upload size={12} /> Recibo
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                <span>Fecha: {formatDate(expense.issueDate)}</span>
                <span>Base: {formatCurrency(expense.taxableBase)}</span>
                <span>IVA: {formatCurrency(expense.taxAmount)}</span>
                <span className="font-semibold text-gray-900">Total: {formatCurrency(expense.total)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-1 flex-shrink-0 ml-2">
              <button
                onClick={() => onDeleteExpense(expense.id)}
                className="text-red-600 hover:text-red-800 transition p-1"
                title="Eliminar"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  </div>

  {filtered.length > 0 && (
    <p className="text-sm text-gray-500 text-center">
      Mostrando {filtered.length} de {sorted.length} gastos
    </p>
  )}
</div>


);
}

function AnalysisPage({ invoices, purchaseInvoices, expenses, clients }) {
// ANÁLISIS DE RENTABILIDAD POR CLIENTE
const clientProfitability = clients
.map((client) => {
const clientInvoices = invoices.filter((inv) => inv.clientId === client.id);
const totalRevenue = clientInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
const clientExpenses = expenses.filter((exp) => exp.description.toLowerCase().includes(client.commercialName.toLowerCase()));
const totalExpenses = clientExpenses.reduce((sum, exp) => sum + Number(exp.total || 0), 0);
const profit = totalRevenue - totalExpenses;
const margin = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(2) : 0;


  return {
    name: client.commercialName || client.fiscalName,
    revenue: round2(totalRevenue),
    expenses: round2(totalExpenses),
    profit: round2(profit),
    margin: Number(margin),
    invoiceCount: clientInvoices.length,
  };
})
.filter((c) => c.revenue > 0)
.sort((a, b) => b.profit - a.profit);


// PROVEEDORES TOP (por gasto en compras)
const topSuppliers = purchaseInvoices
.reduce((acc, inv) => {
const existing = acc.find((s) => s.name === inv.issuerName);
if (existing) {
existing.total += Number(inv.total || 0);
existing.count += 1;
} else {
acc.push({ name: inv.issuerName, total: Number(inv.total || 0), count: 1 });
}
return acc;
}, [])
.sort((a, b) => b.total - a.total)
.slice(0, 5)
.map((s) => ({ ...s, total: round2(s.total), average: round2(s.total / s.count) }));

// PROYECCIÓN DE 3 MESES
const today = new Date();
const currentMonth = today.getMonth();
const currentYear = today.getFullYear();




const monthlyAverage = invoices
.slice(-12)
.reduce((sum, inv) => sum + Number(inv.total || 0), 0) / 12;

const projections = Array.from({ length: 3 }, (_, i) => {
const projMonth = new Date(currentYear, currentMonth + i + 1, 1);
return {
month: projMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
projected: round2(monthlyAverage),
};
});

// RATIOS FINANCIEROS
const totalIncome = invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
const totalExpense = purchaseInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0) + expenses.reduce((sum, exp) => sum + Number(exp.total || 0), 0);
const netProfit = totalIncome - totalExpense;
const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(2) : 0;
const expenseRatio = totalIncome > 0 ? ((totalExpense / totalIncome) * 100).toFixed(2) : 0;

return (
<div className="space-y-6">
<div>
<h1 className="text-3xl font-bold text-gray-900 mb-2">Análisis Avanzado</h1>
<p className="text-gray-600">Profundiza en tu negocio con análisis detallados</p>
</div>


  {/* KPIs PRINCIPALES */}
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
      <p className="text-blue-700 text-sm font-semibold mb-2">Margen de Ganancia</p>
      <p className="text-3xl font-bold text-blue-900">{profitMargin}%</p>
      <p className="text-xs text-blue-600 mt-2">De cada €100 que ingresas</p>
    </div>

    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
      <p className="text-purple-700 text-sm font-semibold mb-2">Ratio de Gasto</p>
      <p className="text-3xl font-bold text-purple-900">{expenseRatio}%</p>
      <p className="text-xs text-purple-600 mt-2">Gasto sobre ingresos</p>
    </div>

    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
      <p className="text-green-700 text-sm font-semibold mb-2">Ingresos Totales</p>
      <p className="text-3xl font-bold text-green-900">{formatCurrency(totalIncome)}</p>
      <p className="text-xs text-green-600 mt-2">{invoices.length} factura(s)</p>
    </div>

    <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
      <p className="text-red-700 text-sm font-semibold mb-2">Beneficio Neto</p>
      <p className={`text-3xl font-bold ${netProfit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
        {formatCurrency(netProfit)}
      </p>
      <p className="text-xs text-red-600 mt-2">Después de gastos</p>
    </div>
  </div>

  {/* RENTABILIDAD POR CLIENTE */}
  <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
    <h2 className="text-xl font-bold text-gray-900 mb-4">Rentabilidad por Cliente</h2>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b-2 border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Cliente</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-700">Ingresos</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-700">Gastos</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-700">Ganancia</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-700">Margen</th>
            <th className="px-4 py-3 text-center font-semibold text-gray-700">Facturas</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {clientProfitability.length === 0 ? (
            <tr>
              <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                Sin datos de clientes
              </td>
            </tr>
          ) : (
            clientProfitability.map((client, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{client.name}</td>
                <td className="px-4 py-3 text-right text-green-600 font-semibold">{formatCurrency(client.revenue)}</td>
                <td className="px-4 py-3 text-right text-red-600">{formatCurrency(client.expenses)}</td>
                <td className="px-4 py-3 text-right text-blue-600 font-semibold">{formatCurrency(client.profit)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${client.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {client.margin.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-center text-gray-600">{client.invoiceCount}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* PROVEEDORES TOP */}
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Top Proveedores</h2>
      <div className="space-y-3">
        {topSuppliers.length === 0 ? (
          <p className="text-gray-500 text-sm">Sin compras registradas</p>
        ) : (
          topSuppliers.map((supplier, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{supplier.name}</p>
                <p className="text-xs text-gray-500">{supplier.count} factura(s)</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{formatCurrency(supplier.total)}</p>
                <p className="text-xs text-gray-500">Promedio: {formatCurrency(supplier.average)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>

    {/* PROYECCIONES */}
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Proyección 3 Meses</h2>
      <p className="text-xs text-gray-500 mb-4">Basado en promedio mensual: {formatCurrency(monthlyAverage)}</p>
      <div className="space-y-3">
        {projections.map((proj, idx) => (
          <div key={idx} className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-200">
            <p className="font-medium text-gray-900 capitalize">{proj.month}</p>
            <p className="font-semibold text-indigo-600">{formatCurrency(proj.projected)}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
</div>


);
}

function ClientsPage({ clients, invoices, onAddClient, onDeleteClient }) {
const [showForm, setShowForm] = useState(false);
const [form, setForm] = useState(getDefaultClientForm());
const [searchTerm, setSearchTerm] = useState('');
const [validationErrors, setValidationErrors] = useState({});

const handleSubmit = () => {
const errors = {};


if (!form.fiscalName.trim()) {
  errors.fiscalName = 'El nombre fiscal es obligatorio.';
}

// ✅ MEJORA 3: Proteger contra CIF duplicados
if (form.cif.trim()) {
  const cifExists = clients.some(
    (c) => c.cif.toUpperCase() === form.cif.toUpperCase()
  );
  if (cifExists) {
    errors.cif = 'Ya existe un cliente con este CIF.';
  }
}

if (form.email && !isValidEmail(form.email.trim())) {
  errors.email = 'Email inválido.';
}

if (form.cif && !isValidCIF(form.cif.trim())) {
  errors.cif = 'Formato de CIF inválido.';
}

setValidationErrors(errors);
if (Object.keys(errors).length > 0) return;

onAddClient({
  ...form,
  fiscalName: form.fiscalName.trim(),
  commercialName: form.commercialName.trim(),
  cif: form.cif.trim().toUpperCase(),
  email: form.email.trim(),
  phone: form.phone.trim(),
  address: form.address.trim(),
  city: form.city.trim(),
  postalCode: form.postalCode.trim(),
  country: form.country.trim(),
  contactPerson: form.contactPerson.trim(),
  notes: form.notes.trim(),
});

setForm(getDefaultClientForm());
setShowForm(false);
setValidationErrors({});


};

const sortedClients = useMemo(
() => [...clients].sort((a, b) => a.fiscalName.localeCompare(b.fiscalName)),
[clients]
);

const filteredClients = useMemo(() => {
if (!searchTerm.trim()) return sortedClients;
const term = searchTerm.toLowerCase();


return sortedClients.filter(
  (client) =>
    (client.fiscalName || '').toLowerCase().includes(term) ||
    (client.commercialName || '').toLowerCase().includes(term) ||
    (client.email || '').toLowerCase().includes(term)
);


}, [sortedClients, searchTerm]);

const clientSummary = useMemo(() => {
const top = clients
.map((client) => ({
id: client.id,
name: client.commercialName || client.fiscalName,
total: round2(
invoices
.filter((invoice) => invoice.clientId === client.id)
.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0)
),
}))
.sort((a, b) => b.total - a.total)[0];


return {
  totalClients: clients.length,
  billedClients: clients.filter((client) =>
    invoices.some((invoice) => invoice.clientId === client.id)
  ).length,
  topClientName: top?.name || '-',
  topClientTotal: top?.total || 0,
};


}, [clients, invoices]);

return (
<div className="space-y-6">
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
<div className="bg-white rounded-lg shadow p-4">
<p className="text-sm text-gray-500">Clientes totales</p>
<p className="text-2xl font-bold">{clientSummary.totalClients}</p>
</div>
<div className="bg-white rounded-lg shadow p-4">
<p className="text-sm text-gray-500">Clientes con facturación</p>
<p className="text-2xl font-bold">{clientSummary.billedClients}</p>
</div>
<div className="bg-white rounded-lg shadow p-4 md:col-span-2">
<p className="text-sm text-gray-500">Mejor cliente histórico</p>
<p className="text-xl font-bold">{clientSummary.topClientName}</p>
<p className="text-sm text-gray-600">{formatCurrency(clientSummary.topClientTotal)}</p>
</div>
</div>


  <div className="flex justify-between items-center gap-4 flex-wrap">
    <h2 className="text-2xl font-bold">Clientes</h2>
    <button
      onClick={() => setShowForm(!showForm)}
      className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
    >
      <Plus size={18} /> Nuevo cliente
    </button>
  </div>

  {showForm && (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <h3 className="font-bold text-lg">Añadir cliente</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div>
          <input
            type="text"
            placeholder="Nombre fiscal *"
            value={form.fiscalName}
            onChange={(e) => setForm({ ...form, fiscalName: e.target.value })}
            className={`w-full border rounded px-3 py-2 ${
              validationErrors.fiscalName ? 'border-red-500' : ''
            }`}
          />
          {validationErrors.fiscalName && (
            <p className="text-red-600 text-xs mt-1">{validationErrors.fiscalName}</p>
          )}
        </div>

        <input
          type="text"
          placeholder="Nombre comercial"
          value={form.commercialName}
          onChange={(e) => setForm({ ...form, commercialName: e.target.value })}
          className="border rounded px-3 py-2"
        />

        <div>
          <input
            type="text"
            placeholder="CIF / NIF"
            value={form.cif}
            onChange={(e) => setForm({ ...form, cif: e.target.value })}
            className={`w-full border rounded px-3 py-2 ${
              validationErrors.cif ? 'border-red-500' : ''
            }`}
          />
          {validationErrors.cif && (
            <p className="text-red-600 text-xs mt-1">{validationErrors.cif}</p>
          )}
        </div>

        <input
          type="text"
          placeholder="Persona de contacto"
          value={form.contactPerson}
          onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
          className="border rounded px-3 py-2"
        />

        <div>
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={`w-full border rounded px-3 py-2 ${
              validationErrors.email ? 'border-red-500' : ''
            }`}
          />
          {validationErrors.email && (
            <p className="text-red-600 text-xs mt-1">{validationErrors.email}</p>
          )}
        </div>

        <input
          type="tel"
          placeholder="Teléfono"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="border rounded px-3 py-2"
        />

        <input
          type="text"
          placeholder="Dirección"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className="border rounded px-3 py-2"
        />

        <input
          type="text"
          placeholder="Ciudad"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          className="border rounded px-3 py-2"
        />

        <input
          type="text"
          placeholder="Código postal"
          value={form.postalCode}
          onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
          className="border rounded px-3 py-2"
        />

        <input
          type="text"
          placeholder="País"
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })}
          className="border rounded px-3 py-2"
        />

        <select
          value={form.clientType}
          onChange={(e) => setForm({ ...form, clientType: e.target.value })}
          className="border rounded px-3 py-2"
          title="Determina la retención por defecto en facturas"
        >
          <option value="company">Empresa (Retención 0%)</option>
          <option value="professional">Profesional (Retención 15%)</option>
        </select>
      </div>

      <textarea
        placeholder="Notas"
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
        className="w-full border rounded px-3 py-2 min-h-[90px]"
      />

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={handleSubmit}
          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
        >
          Guardar cliente
        </button>
        <button
          onClick={() => {
            setShowForm(false);
            setValidationErrors({});
          }}
          className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition"
        >
          Cancelar
        </button>
      </div>
    </div>
  )}

  <div className="bg-white rounded-lg shadow p-4">
    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
      <Search size={20} className="text-gray-400" />
      <input
        type="text"
        placeholder="Buscar cliente..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="flex-1 bg-gray-50 outline-none text-sm"
      />
      {searchTerm && (
        <button
          onClick={() => setSearchTerm('')}
          className="text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>
      )}
    </div>
  </div>

  <div className="bg-white rounded-xl shadow-md overflow-y-auto max-h-[600px] border border-gray-100">
    <div className="divide-y">
      {filteredClients.length === 0 ? (
        <div className="px-4 py-8 text-center text-gray-500 text-sm">
          {searchTerm ? 'No se encontraron resultados.' : 'No hay clientes todavía.'}
        </div>
      ) : (
        filteredClients.map((client) => (
          <div key={client.id} className="px-4 py-4 hover:bg-gray-50 transition flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-gray-900 text-sm">{client.fiscalName}</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                    client.clientType === 'professional'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  {client.clientType === 'professional' ? 'Profesional' : 'Empresa'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-600 flex-wrap">
                {client.commercialName && <span>Comercial: {client.commercialName}</span>}
                {client.email && <span>Email: {client.email}</span>}
              </div>
            </div>

            <div className="flex items-center justify-end flex-shrink-0">
              <button
                onClick={() => onDeleteClient(client.id)}
                className="text-red-600 hover:text-red-800 transition p-1"
                title="Eliminar"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  </div>

  {filteredClients.length > 0 && (
    <p className="text-sm text-gray-500 text-center">
      Mostrando {filteredClients.length} de {sortedClients.length} clientes
    </p>
  )}
</div>


);
}

export default function AccountingApp() {
const [user, setUser] = useState(null);
const [currentPage, setCurrentPage] = useState('dashboard');
const [sidebarOpen, setSidebarOpen] = useState(true);
const [selectedPeriod, setSelectedPeriod] = useState(String(new Date().getFullYear()));
const [selectedQuarter, setSelectedQuarter] = useState('full');

const [clients, setClients] = useState([]);
const [invoices, setInvoices] = useState([]);
const [purchaseInvoices, setPurchaseInvoices] = useState([]);
const [expenses, setExpenses] = useState([]);

useEffect(() => {
  const loadSupabaseData = async () => {
    if (!USE_SUPABASE) return;

    const [
      { data: clientsData, error: clientsError },
      { data: invoicesData, error: invoicesError },
      { data: purchaseInvoicesData, error: purchaseInvoicesError },
      { data: expensesData, error: expensesError },
    ] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: true }),
      supabase.from('invoices').select('*').order('created_at', { ascending: true }),
      supabase.from('purchase_invoices').select('*').order('created_at', { ascending: true }),
      supabase.from('expenses').select('*').order('created_at', { ascending: true }),
    ]);

    if (clientsError) console.error('Error cargando clientes:', clientsError);
    if (invoicesError) console.error('Error cargando facturas:', invoicesError);
    if (purchaseInvoicesError) console.error('Error cargando facturas recibidas:', purchaseInvoicesError);
    if (expensesError) console.error('Error cargando gastos:', expensesError);

    if (clientsData) {
      setClients(
        clientsData.map((client) => ({
          id: client.id,
          fiscalName: client.fiscal_name,
          commercialName: client.commercial_name,
          cif: client.cif,
          email: client.email,
          phone: client.phone,
          address: client.address,
          city: client.city,
          postalCode: client.postal_code,
          country: client.country,
          contactPerson: client.contact_person,
          clientType: client.client_type,
          notes: client.notes,
          createdAt: client.created_at,
        }))
      );
    }

    if (invoicesData) {
      setInvoices(
        invoicesData.map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoice_number,
          clientId: invoice.client_id,
          issueDate: invoice.issue_date,
          dueDate: invoice.due_date,
          paymentDate: invoice.payment_date,
          orderNumber: invoice.order_number,
          visibleNotes: invoice.visible_notes,
          internalNotes: invoice.internal_notes,
          status: invoice.status,
          subtotal: invoice.subtotal,
          totalTax: invoice.total_tax,
          retentionPercentage: invoice.retention_percentage,
          retentionAmount: invoice.retention_amount,
          total: invoice.total,
          items: invoice.items || [],
          createdAt: invoice.created_at,
        }))
      );
    }

    if (purchaseInvoicesData) {
      setPurchaseInvoices(
        purchaseInvoicesData.map((item) => ({
          id: item.id,
          issuerName: item.issuer_name,
          issuerTaxId: item.issuer_tax_id,
          issueDate: item.issue_date,
          paymentDate: item.payment_date,
          concept: item.concept,
          category: item.category,
          taxableBase: item.taxable_base,
          taxPercentage: item.tax_percentage,
          taxAmount: item.tax_amount,
          withholdingPercentage: item.withholding_percentage,
          withholdingAmount: item.withholding_amount,
          total: item.total,
          notes: item.notes,
          attachmentName: item.attachment_name,
          paymentStatus: item.payment_status,
          createdAt: item.created_at,
        }))
      );
    }

    if (expensesData) {
      setExpenses(
        expensesData.map((item) => ({
          id: item.id,
          description: item.description,
          category: item.category,
          issueDate: item.issue_date,
          paymentDate: item.payment_date,
          taxableBase: item.taxable_base,
          taxPercentage: item.tax_percentage,
          taxAmount: item.tax_amount,
          total: item.total,
          notes: item.notes,
          receiptName: item.receipt_name,
          hasReceipt: item.has_receipt,
          createdAt: item.created_at,
        }))
      );
    }
  };

  loadSupabaseData();
}, []);

// Estado para modal de confirmación de borrado
const [deleteConfirmation, setDeleteConfirmation] = useState(null);


const handleGoogleAuth = () => {
const authUser = {
id: 'google-demo',
name: COMPANY.legalName,
email: 'empresa@example.com',
authType: 'google-demo',
};
setUser(authUser);
saveToStorage(STORAGE_KEYS.user, authUser);
};

const handleLocalLogin = () => {
const localUser = {
id: 'local',
name: COMPANY.legalName,
email: 'local@example.com',
authType: 'local',
};
setUser(localUser);
saveToStorage(STORAGE_KEYS.user, localUser);
};

const handleLoadDemo = () => {
const demoUser = {
id: 'demo',
name: COMPANY.legalName,
email: 'demo@example.com',
authType: 'demo',
};


const demo = createDemoData();

setUser(demoUser);
setClients(demo.clients);
setInvoices(demo.invoices);
setPurchaseInvoices(demo.purchaseInvoices);
setExpenses(demo.expenses);
setSelectedPeriod('2026');
setSelectedQuarter('full');

saveToStorage(STORAGE_KEYS.user, demoUser);
saveToStorage(STORAGE_KEYS.clients, demo.clients);
saveToStorage(STORAGE_KEYS.invoices, demo.invoices);
saveToStorage(STORAGE_KEYS.purchaseInvoices, demo.purchaseInvoices);
saveToStorage(STORAGE_KEYS.expenses, demo.expenses);


};



const handleLogout = () => {
setUser(null);
localStorage.removeItem(STORAGE_KEYS.user);
};

// ✅ MEJORA 6: Exportar datos
const handleExportData = () => {
const data = {
clients,
invoices,
purchaseInvoices,
expenses,
exportedAt: new Date().toISOString(),
company: COMPANY,
};
const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `backup-${getToday()}.json`;
a.click();
URL.revokeObjectURL(url);
};

// ✅ MEJORA 6: Limpiar todos los datos
const handleClearAllData = () => {
const confirmed = window.confirm(
'⚠️ ADVERTENCIA: Esto eliminará TODOS los datos permanentemente.\n\nEsta acción no se puede deshacer.\n\n¿Estás completamente seguro?'
);
if (!confirmed) return;


const confirmed2 = window.confirm('⚠️ SEGUNDA CONFIRMACIÓN: ¿Realmente quieres continuar?\n\nEsta es la última advertencia.');
if (!confirmed2) return;

setClients([]);
setInvoices([]);
setPurchaseInvoices([]);
setExpenses([]);

localStorage.removeItem(STORAGE_KEYS.clients);
localStorage.removeItem(STORAGE_KEYS.invoices);
localStorage.removeItem(STORAGE_KEYS.purchaseInvoices);
localStorage.removeItem(STORAGE_KEYS.expenses);

alert('✅ Todos los datos han sido eliminados.');


};

const addClient = async (clientData) => {
  const newClient = {
    id: Date.now().toString(),
    ...clientData,
    createdAt: new Date().toISOString(),
  };

  if (!USE_SUPABASE) {
    const updated = [...clients, newClient];
    setClients(updated);
    saveToStorage(STORAGE_KEYS.clients, updated);
    return true;
  }

  const payload = {
    id: newClient.id,
    fiscal_name: newClient.fiscalName,
    commercial_name: newClient.commercialName,
    cif: newClient.cif,
    email: newClient.email,
    phone: newClient.phone,
    address: newClient.address,
    city: newClient.city,
    postal_code: newClient.postalCode,
    country: newClient.country,
    contact_person: newClient.contactPerson,
    client_type: newClient.clientType,
    notes: newClient.notes,
    created_at: newClient.createdAt,
  };

  const { error } = await supabase.from('clients').insert(payload);

  if (error) {
    console.error('Error guardando cliente en Supabase:', error);
    alert('No se pudo guardar el cliente en Supabase.');
    return false;
  }

  const updated = [...clients, newClient];
  setClients(updated);
  return true;
};
const deleteClient = (id) => {
  const hasInvoices = invoices.some((invoice) => invoice.clientId === id);

  if (hasInvoices) {
    setDeleteConfirmation({
      type: 'error',
      id,
      name: 'No se puede eliminar',
      message: 'Este cliente tiene facturas asociadas. Elimina las facturas primero.',
      onConfirm: () => setDeleteConfirmation(null),
    });
    return;
  }

  const client = clients.find((c) => c.id === id);

  setDeleteConfirmation({
    type: 'client',
    id,
    name: `Cliente: ${client?.commercialName || client?.fiscalName || 'desconocido'}`,
    onConfirm: async () => {
      if (!USE_SUPABASE) {
        const updated = clients.filter((client) => client.id !== id);
        setClients(updated);
        saveToStorage(STORAGE_KEYS.clients, updated);
        setDeleteConfirmation(null);
        return;
      }

      const { error } = await supabase.from('clients').delete().eq('id', id);

      if (error) {
        console.error('Error eliminando cliente en Supabase:', error);
        alert('No se pudo eliminar el cliente en Supabase.');
        return;
      }

      const updated = clients.filter((client) => client.id !== id);
      setClients(updated);
      setDeleteConfirmation(null);
    },
  });
};

const createInvoice = (form, status) => {
const validItems = form.items.filter(
(item) =>
item.description.trim() !== '' &&
Number(item.baseAmount) > 0
);




const totals = calculateInvoiceTotals(validItems, form.retentionPercentage);

const invoice = {
  id: Date.now().toString(),
  invoiceNumber: generateInvoiceNumber(invoices, form.issueDate),
  clientId: form.clientId,
  issueDate: form.issueDate,
  dueDate: form.dueDate,
  paymentDate: null,
  orderNumber: form.orderNumber.trim(),
  visibleNotes: form.visibleNotes.trim(),
  internalNotes: form.internalNotes.trim(),
  items: validItems.map((item) => ({
    description: item.description.trim(),
    baseAmount: round2(item.baseAmount),
    quantity: Number(item.quantity || 1),
    tax: Number(item.tax || 21),
  })),
  status,
  ...totals,
  createdAt: new Date().toISOString(),
};

const updated = [...invoices, invoice];
setInvoices(updated);
saveToStorage(STORAGE_KEYS.invoices, updated);

if (USE_SUPABASE) {
  saveInvoiceToSupabase(invoice);
}

setCurrentPage('emitted-invoices');
return true;


};

const saveInvoiceToSupabase = async (invoice) => {
  const payload = {
    id: invoice.id,
    invoice_number: invoice.invoiceNumber,
    client_id: invoice.clientId,
    issue_date: invoice.issueDate,
    due_date: invoice.dueDate || null,
    payment_date: invoice.paymentDate,
    order_number: invoice.orderNumber,
    visible_notes: invoice.visibleNotes,
    internal_notes: invoice.internalNotes,
    status: invoice.status,
    subtotal: invoice.subtotal,
    total_tax: invoice.totalTax,
    retention_percentage: invoice.retentionPercentage,
    retention_amount: invoice.retentionAmount,
    total: invoice.total,
    items: invoice.items,
    created_at: invoice.createdAt,
  };

  const { error } = await supabase.from('invoices').insert(payload);

  if (error) {
    console.error('Error guardando factura en Supabase:', error);
    return { ok: false, error };
  }

  return { ok: true };
};

const deleteInvoice = (id) => {
  const invoice = invoices.find((inv) => inv.id === id);

  setDeleteConfirmation({
    type: 'invoice',
    id,
    name: `Factura ${invoice?.invoiceNumber || 'desconocida'}`,
    onConfirm: async () => {
      if (!USE_SUPABASE) {
        const updated = invoices.filter((invoice) => invoice.id !== id);
        setInvoices(updated);
        saveToStorage(STORAGE_KEYS.invoices, updated);
        setDeleteConfirmation(null);
        return;
      }

      const { error } = await supabase.from('invoices').delete().eq('id', id);

      if (error) {
        console.error('Error eliminando factura en Supabase:', error);
        alert('No se pudo eliminar la factura en Supabase.');
        return;
      }

      const updated = invoices.filter((invoice) => invoice.id !== id);
      setInvoices(updated);
      setDeleteConfirmation(null);
    },
  });
};

const markInvoiceAsPaid = async (id) => {
  const updated = invoices.map((invoice) =>
    invoice.id === id
      ? {
          ...invoice,
          status: 'paid',
          paymentDate: getToday(),
        }
      : invoice
  );

  const updatedInvoice = updated.find((invoice) => invoice.id === id);

  if (!USE_SUPABASE) {
    setInvoices(updated);
    saveToStorage(STORAGE_KEYS.invoices, updated);
    return;
  }

  const { error } = await supabase
    .from('invoices')
    .update({
      status: updatedInvoice.status,
      payment_date: updatedInvoice.paymentDate,
    })
    .eq('id', id);

  if (error) {
    console.error('Error marcando factura como pagada en Supabase:', error);
    alert('No se pudo actualizar la factura en Supabase.');
    return;
  }

  setInvoices(updated);
};

const markInvoiceAsSent = async (id) => {
  const updated = invoices.map((invoice) =>
    invoice.id === id
      ? {
          ...invoice,
          status: 'sent',
        }
      : invoice
  );

  const updatedInvoice = updated.find((invoice) => invoice.id === id);

  if (!USE_SUPABASE) {
    setInvoices(updated);
    saveToStorage(STORAGE_KEYS.invoices, updated);
    return;
  }

  const { error } = await supabase
    .from('invoices')
    .update({
      status: updatedInvoice.status,
    })
    .eq('id', id);

  if (error) {
    console.error('Error marcando factura como emitida en Supabase:', error);
    alert('No se pudo actualizar la factura en Supabase.');
    return;
  }

  setInvoices(updated);
};

const markInvoiceAsUnpaid = async (id) => {
  const updated = invoices.map((invoice) =>
    invoice.id === id
      ? {
          ...invoice,
          status: 'sent',
          paymentDate: null,
        }
      : invoice
  );

  const updatedInvoice = updated.find((invoice) => invoice.id === id);

  if (!USE_SUPABASE) {
    setInvoices(updated);
    saveToStorage(STORAGE_KEYS.invoices, updated);
    return;
  }

  const { error } = await supabase
    .from('invoices')
    .update({
      status: updatedInvoice.status,
      payment_date: null,
    })
    .eq('id', id);

  if (error) {
    console.error('Error desmarcando factura como pagada en Supabase:', error);
    alert('No se pudo actualizar la factura en Supabase.');
    return;
  }

  setInvoices(updated);
};

const addPurchaseInvoice = async (invoiceData) => {
  const newItem = {
    id: Date.now().toString(),
    ...invoiceData,
    createdAt: new Date().toISOString(),
  };

  if (!USE_SUPABASE) {
    const updated = [...purchaseInvoices, newItem];
    setPurchaseInvoices(updated);
    saveToStorage(STORAGE_KEYS.purchaseInvoices, updated);
    return;
  }

  const payload = {
    id: newItem.id,
    issuer_name: newItem.issuerName,
    issuer_tax_id: newItem.issuerTaxId,
    issue_date: newItem.issueDate,
    payment_date: newItem.paymentDate || null,
    concept: newItem.concept,
    category: newItem.category,
    taxable_base: newItem.taxableBase,
    tax_percentage: newItem.taxPercentage,
    tax_amount: newItem.taxAmount,
    withholding_percentage: newItem.withholdingPercentage,
    withholding_amount: newItem.withholdingAmount,
    total: newItem.total,
    notes: newItem.notes,
    attachment_name: newItem.attachmentName,
    payment_status: newItem.paymentStatus,
    created_at: newItem.createdAt,
  };

  const { error } = await supabase.from('purchase_invoices').insert(payload);

  if (error) {
    console.error('Error guardando factura recibida en Supabase:', error);
    alert('No se pudo guardar la factura recibida en Supabase.');
    return;
  }

  setPurchaseInvoices([...purchaseInvoices, newItem]);
};

const deletePurchaseInvoice = (id) => {
  const purchase = purchaseInvoices.find((item) => item.id === id);

  setDeleteConfirmation({
    type: 'purchaseInvoice',
    id,
    name: `Factura recibida de ${purchase?.issuerName || 'desconocido'}`,
    onConfirm: async () => {
      if (!USE_SUPABASE) {
        const updated = purchaseInvoices.filter((item) => item.id !== id);
        setPurchaseInvoices(updated);
        saveToStorage(STORAGE_KEYS.purchaseInvoices, updated);
        setDeleteConfirmation(null);
        return;
      }

      const { error } = await supabase
        .from('purchase_invoices')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error eliminando factura recibida en Supabase:', error);
        alert('No se pudo eliminar la factura recibida en Supabase.');
        return;
      }

      const updated = purchaseInvoices.filter((item) => item.id !== id);
      setPurchaseInvoices(updated);
      setDeleteConfirmation(null);
    },
  });
};

const markPurchaseInvoicePaid = async (id) => {
  const updated = purchaseInvoices.map((item) =>
    item.id === id
      ? {
          ...item,
          paymentStatus: 'paid',
          paymentDate: item.paymentDate || getToday(),
        }
      : item
  );

  const updatedItem = updated.find((item) => item.id === id);

  if (!USE_SUPABASE) {
    setPurchaseInvoices(updated);
    saveToStorage(STORAGE_KEYS.purchaseInvoices, updated);
    return;
  }

  const { error } = await supabase
    .from('purchase_invoices')
    .update({
      payment_status: updatedItem.paymentStatus,
      payment_date: updatedItem.paymentDate,
    })
    .eq('id', id);

  if (error) {
    console.error('Error marcando factura recibida como pagada en Supabase:', error);
    alert('No se pudo actualizar la factura recibida en Supabase.');
    return;
  }

  setPurchaseInvoices(updated);
};

const markPurchaseInvoiceUnpaid = async (id) => {
  const updated = purchaseInvoices.map((item) =>
    item.id === id
      ? {
          ...item,
          paymentStatus: 'pending',
          paymentDate: null,
        }
      : item
  );

  const updatedItem = updated.find((item) => item.id === id);

  if (!USE_SUPABASE) {
    setPurchaseInvoices(updated);
    saveToStorage(STORAGE_KEYS.purchaseInvoices, updated);
    return;
  }

  const { error } = await supabase
    .from('purchase_invoices')
    .update({
      payment_status: updatedItem.paymentStatus,
      payment_date: null,
    })
    .eq('id', id);

  if (error) {
    console.error('Error desmarcando factura recibida como pagada en Supabase:', error);
    alert('No se pudo actualizar la factura recibida en Supabase.');
    return;
  }

  setPurchaseInvoices(updated);
};

const addExpense = async (expenseData) => {
  const newExpense = {
    id: Date.now().toString(),
    ...expenseData,
    createdAt: new Date().toISOString(),
  };

  if (!USE_SUPABASE) {
    const updated = [...expenses, newExpense];
    setExpenses(updated);
    saveToStorage(STORAGE_KEYS.expenses, updated);
    return;
  }

  const payload = {
    id: newExpense.id,
    description: newExpense.description,
    category: newExpense.category,
    issue_date: newExpense.issueDate,
    payment_date: newExpense.paymentDate || null,
    taxable_base: newExpense.taxableBase,
    tax_percentage: newExpense.taxPercentage,
    tax_amount: newExpense.taxAmount,
    total: newExpense.total,
    notes: newExpense.notes,
    receipt_name: newExpense.receiptName,
    has_receipt: newExpense.hasReceipt,
    created_at: newExpense.createdAt,
  };

  const { error } = await supabase.from('expenses').insert(payload);

  if (error) {
    console.error('Error guardando gasto en Supabase:', error);
    alert('No se pudo guardar el gasto en Supabase.');
    return;
  }

  setExpenses([...expenses, newExpense]);
};

const deleteExpense = (id) => {
const expense = expenses.find((exp) => exp.id === id);
setDeleteConfirmation({
type: 'expense',
id,
name: `Gasto: ${expense?.description || 'desconocido'}`,
onConfirm: () => {
const updated = expenses.filter((expense) => expense.id !== id);
setExpenses(updated);
saveToStorage(STORAGE_KEYS.expenses, updated);
setDeleteConfirmation(null);
},
});
};

if (!user) {
return (
<LoginScreen
onGoogleAuth={handleGoogleAuth}
onLocalLogin={handleLocalLogin}
onLoadDemo={handleLoadDemo}
/>
);
}

return (
<div className="min-h-screen bg-gray-100">
<header className="bg-white shadow sticky top-0 z-40">
<div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
<div className="flex items-center gap-4">
<button
  onClick={() => setSidebarOpen(!sidebarOpen)}
  className="text-gray-600 hover:text-gray-800 transition"
>
  {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
</button>


        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            {APP_NAME}
          </h1>
          <p className="text-xs text-gray-500">{APP_TAGLINE}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
  <span className="text-sm text-gray-600 hidden md:block">{user.name}</span>

 

  <button
    onClick={handleExportData}
    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
    title="Descargar backup de datos"
  >
    <Download size={18} />
  </button>

  <button
  onClick={handleLogout}
  className="text-red-600 hover:text-red-800 flex items-center gap-1 transition"
>
  <LogOut size={18} /> Salir
</button>
</div>
</div>
</header>

  <div className="flex relative">
    {sidebarOpen && (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden top-16"
        onClick={() => setSidebarOpen(false)}
      />
    )}
    <aside
      className={`${
        sidebarOpen ? 'w-72' : 'w-0 lg:w-72'
      } bg-gray-900 text-white transition-all duration-300 overflow-y-auto min-h-[calc(100vh-76px)] fixed lg:static left-0 top-16 z-30 lg:z-0`}
      style={{
        width: sidebarOpen ? '288px' : '0px',
      }}
    >
      <nav className="p-4 space-y-2">
        <button
          onClick={() => {
            setCurrentPage('dashboard');
            setSidebarOpen(false);
          }}
          className={`w-full text-left px-4 py-2 rounded transition ${
            currentPage === 'dashboard' ? 'bg-blue-600' : 'hover:bg-gray-800'
          }`}
        >
          📊 Dashboard
        </button>

        <div className="pt-2">
          <p className="px-4 text-xs uppercase tracking-wide text-gray-400 mb-2">
            Facturación
          </p>

          <button
            onClick={() => {
              setCurrentPage('emitted-invoices');
              setSidebarOpen(false);
            }}
            className={`w-full text-left px-4 py-2 rounded transition ${
              currentPage === 'emitted-invoices' || currentPage === 'create-invoice'
                ? 'bg-blue-600'
                : 'hover:bg-gray-800'
            }`}
          >
            📄 Facturas emitidas
          </button>

          <button
            onClick={() => {
              setCurrentPage('purchase-invoices');
              setSidebarOpen(false);
            }}
            className={`w-full text-left px-4 py-2 rounded transition ${
              currentPage === 'purchase-invoices' ? 'bg-blue-600' : 'hover:bg-gray-800'
            }`}
          >
            🧾 Facturas recibidas
          </button>

          <button
            onClick={() => {
              setCurrentPage('expenses');
              setSidebarOpen(false);
            }}
            className={`w-full text-left px-4 py-2 rounded transition ${
              currentPage === 'expenses' ? 'bg-blue-600' : 'hover:bg-gray-800'
            }`}
          >
            💰 Gastos
          </button>
        </div>

        <div className="pt-2">
          <p className="px-4 text-xs uppercase tracking-wide text-gray-400 mb-2">
            Análisis
          </p>

          <button
            onClick={() => {
              setCurrentPage('analysis');
              setSidebarOpen(false);
            }}
            className={`w-full text-left px-4 py-2 rounded transition ${
              currentPage === 'analysis' ? 'bg-blue-600' : 'hover:bg-gray-800'
            }`}
          >
            📈 Análisis avanzado
          </button>
        </div>

        <div className="pt-2">
          <p className="px-4 text-xs uppercase tracking-wide text-gray-400 mb-2">
            Clientes
          </p>

          <button
            onClick={() => {
              setCurrentPage('clients');
              setSidebarOpen(false);
            }}
            className={`w-full text-left px-4 py-2 rounded transition ${
              currentPage === 'clients' ? 'bg-blue-600' : 'hover:bg-gray-800'
            }`}
          >
            👥 Gestión de clientes
          </button>
        </div>

        <div className="pt-4 border-t border-gray-700">
          <button
            onClick={handleClearAllData}
            className="w-full text-left px-4 py-2 rounded text-red-400 hover:bg-red-900 transition text-sm"
          >
            🗑️ Limpiar todos los datos
          </button>
        </div>
      </nav>
    </aside>

    <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
      {currentPage === 'dashboard' && (
        <DashboardPage
          selectedPeriod={selectedPeriod}
          setSelectedPeriod={setSelectedPeriod}
          selectedQuarter={selectedQuarter}
          setSelectedQuarter={setSelectedQuarter}
          invoices={invoices}
          purchaseInvoices={purchaseInvoices}
          expenses={expenses}
          clients={clients}
        />
      )}

      {currentPage === 'emitted-invoices' && (
        <InvoicesPage
          invoices={invoices}
          clients={clients}
          onGoCreate={() => setCurrentPage('create-invoice')}
          onDelete={deleteInvoice}
          onMarkAsPaid={markInvoiceAsPaid}
          onMarkAsUnpaid={markInvoiceAsUnpaid}
          onMarkAsSent={markInvoiceAsSent}
        />
      )}

      {currentPage === 'create-invoice' && (
        <CreateInvoicePage
          clients={clients}
          onCreateInvoice={createInvoice}
          onCancel={() => setCurrentPage('emitted-invoices')}
        />
      )}

      {currentPage === 'purchase-invoices' && (
        <PurchaseInvoicesPage
          purchaseInvoices={purchaseInvoices}
          onAddPurchaseInvoice={addPurchaseInvoice}
          onDelete={deletePurchaseInvoice}
          onMarkPaid={markPurchaseInvoicePaid}
          onMarkUnpaid={markPurchaseInvoiceUnpaid}
        />
      )}

      {currentPage === 'expenses' && (
        <ExpensesPage
          expenses={expenses}
          onAddExpense={addExpense}
          onDeleteExpense={deleteExpense}
        />
      )}

      {currentPage === 'analysis' && (
        <AnalysisPage
          invoices={invoices}
          purchaseInvoices={purchaseInvoices}
          expenses={expenses}
          clients={clients}
        />
      )}

      {currentPage === 'clients' && (
        <ClientsPage
          clients={clients}
          invoices={invoices}
          onAddClient={addClient}
          onDeleteClient={deleteClient}
        />
      )}
    </main>
  </div>

  {/* MODAL DE CONFIRMACIÓN DE BORRADO */}
  {deleteConfirmation && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
            deleteConfirmation.type === 'error' 
              ? 'bg-red-100' 
              : 'bg-yellow-100'
          }`}>
            {deleteConfirmation.type === 'error' ? (
              <AlertTriangle size={24} className="text-red-600" />
            ) : (
              <Trash2 size={24} className="text-orange-600" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold">
              {deleteConfirmation.type === 'error' ? deleteConfirmation.name : '¿Estás seguro?'}
            </h3>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          {deleteConfirmation.type === 'error' ? (
            <p>{deleteConfirmation.message}</p>
          ) : (
            <>
              <p>Estás a punto de eliminar:</p>
              <p className="font-semibold text-gray-900 mt-2">{deleteConfirmation.name}</p>
              <p className="mt-3 text-red-600">
                ⚠️ Esta acción no se puede deshacer.
              </p>
            </>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t">
          {deleteConfirmation.type === 'error' ? (
            <button
              onClick={() => setDeleteConfirmation(null)}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Entendido
            </button>
          ) : (
            <>
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={deleteConfirmation.onConfirm}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium"
              >
                Sí, eliminar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )}
</div>


);
}