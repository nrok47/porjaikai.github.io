// App client for connecting to Google Apps Script or local CSV fallback
const App = (function(){
  //const BASE_URL = 'https://script.google.com/macros/s/AKfycbxy9eAYKy-8HjBOCcWEz2A2sTVJFGylQQciVWvMfMfzPAu771cbkh8h7vQoPOYgByLj/exec';
  const BASE_URL = 'https://script.google.com/macros/s/AKfycbxy9eAYKy-8HjBOCcWEz2A2sTVJFGylQQciVWvMfMfzPAu771cbkh8h7vQoPOYgByLj/exec';
  const SHEET_ID = '1DWA2VlKwmYbvmxTmXUQJQOTalxVOPmx5lAqq8EFtQ0w';

  async function fetchGet(params){
    try {
      const url = new URL(BASE_URL);
      params = Object.assign({sheetId: SHEET_ID}, params||{});
      url.search = new URLSearchParams(params);
      const res = await fetch(url.toString());
      return res.json().catch(()=>null);
    } catch(e) {
      return null;
    }
  }

  async function fetchPost(body){
    try {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: {'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify(Object.assign({sheetId: SHEET_ID}, body))
      });
      return res.json().catch(()=>null);
    } catch(e) {
      return null;
    }
  }

  // CSV fallback: try to load local CSV if script returns null
  async function fetchCSV(path){
    try{
      const r = await fetch(path);
      if(!r.ok) throw new Error('no');
      const txt = await r.text();
      return parseCSVBlock(txt);
    }catch(e){
      return null;
    }
  }

  function parseCSVBlock(txt){
    // remove surrounding code fences if present
    txt = txt.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
    const lines = txt.split(/\r?\n/).filter(Boolean);
    const hdr = lines.shift().split(',');
    return lines.map(l=>{
      const vals = splitCSV(l);
      const obj = {};
      hdr.forEach((h,i)=>obj[h.trim()]=vals[i]);
      return obj;
    });
  }

  function splitCSV(line){
    // CSV splitter that handles quoted fields with commas and escaped quotes
    const res = [];
    let cur='';
    let inQ=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      const nextCh=line[i+1];
      // Handle escaped quotes: "" becomes "
      if(ch==='"' && nextCh==='"' && inQ){ 
        cur += '"'; 
        i++; // skip next quote
        continue; 
      }
      if(ch==='"') { inQ=!inQ; continue; }
      if(ch===',' && !inQ){ res.push(cur); cur=''; continue; }
      cur += ch;
    }
    res.push(cur);
    return res;
  }

  // Public API: listSellers, listOrders, createOrder, confirmPayment, updateStock, saveProduct
  async function listSellers(){
    const r = await fetchGet({action:'listSellers'});
    if(r && Array.isArray(r)) return r.map(x=>normalizeSeller(x));
    // fallback to local CSV
    const csv = await fetchCSV('/ร้านพอใจขาย - seller (1).csv');
    if(csv) return csv.map(x=>({itemId: x.itemId, name: x.name, price:Number(x.price||0), stock:Number(x.stock||0)}));
    return [];
  }

  async function listOrders(){
    const r = await fetchGet({action:'listOrders'});
    if(r && Array.isArray(r)) return r.map(normalizeOrder);
    const csv = await fetchCSV('/ร้านพอใจขาย - orderz.csv');
    if(csv) return csv.map(normalizeOrder);
    return [];
  }

  function normalizeSeller(s){
    return {itemId: s.itemId||s.itemID||s['itemId'], name: s.name, price: Number(s.price||0), stock: Number(s.stock||0)};
  }

  function normalizeOrder(o){
    // handle CSV fields like the repo example
    const obj = Object.assign({}, o);
    if(typeof obj['orders (JSON)'] === 'string' && obj['orders (JSON)'].trim()){
      try{ obj.orders = JSON.parse(obj['orders (JSON)']); }catch(e){ obj.orders = {} }
    }
    if(obj.orders && typeof obj.orders === 'string'){
      try{ obj.orders = JSON.parse(obj.orders); }catch(e){ }
    }
    obj.totalAmount = Number(obj.totalAmount||0);
    obj.paidAmount = Number(obj.paidAmount||0);
    obj.paid = String(obj.paid).toLowerCase() === 'true' || obj.paid === true;
    return obj;
  }

  function prettyItems(items){
    if(!items) return '';
    if(typeof items === 'object'){
      return Object.entries(items).map(([id,v])=>`${id} x${v.qty} @${v.price}`).join('<br>');
    }
    return String(items);
  }

  // actions that call Apps Script
  async function createOrder(order){
    return fetchPost({action:'createOrder', order});
  }

  async function confirmPayment(orderId){
    // Accept optional method
    if(arguments.length > 1){
      const method = arguments[1];
      return fetchPost({action:'confirmPayment', orderId, method});
    }
    return fetchPost({action:'confirmPayment', orderId});
  }

  async function updateStock(itemId, delta){
    return fetchPost({action:'updateStock', itemId, delta});
  }

  async function saveProduct(p){
    return fetchPost({action:'saveProduct', product:p});
  }

  // Update sending status (orderz!I sending_status) for an order
  async function updateOrderSendingStatus(orderId, status){
    return fetchPost({action:'updateOrderSendingStatus', orderId, status});
  }

  // Update place sent (orderz!J place_sent) for an order
  async function updateOrderPlace(orderId, place){
    return fetchPost({action:'updateOrderPlace', orderId, place});
  }

  return {
    listSellers,
    listOrders,
    createOrder,
    confirmPayment,
    updateStock,
    saveProduct,
    updateOrderSendingStatus,
    updateOrderPlace,
    prettyItems,
    normalizeOrder
  };
})();
