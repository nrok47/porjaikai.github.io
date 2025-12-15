/**
 * Google Apps Script backend for พอใจขาย webapp
 * Sheet ID: 1DWA2VlKwmYbvmxTmXUQJQOTalxVOPmx5lAqq8EFtQ0w
 * Deploy as web app: Anyone, even anonymous
 * Supports doGet/doPost for actions: listSellers, listOrders, createOrder, confirmPayment, updateStock, saveProduct
 */

function doGet(e) {
  return handleRequest(e, false);
}

function doPost(e) {
  var data = {};
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {}
  return handleRequest(data, true);
}

function handleRequest(e, isPost) {
  var action = e.action || (e.parameter && e.parameter.action);
  var sheetId = e.sheetId || (e.parameter && e.parameter.sheetId) || '1DWA2VlKwmYbvmxTmXUQJQOTalxVOPmx5lAqq8EFtQ0w';
  var ss = SpreadsheetApp.openById(sheetId);
  if (action === 'listSellers') {
    var sellers = getSheetData(ss, 'seller');
    return jsonResponse(sellers);
  }
  if (action === 'listOrders') {
    var orders = getSheetData(ss, 'orderz');
    return jsonResponse(orders);
  }
  if (action === 'createOrder') {
    var order = e.order;
    var sheet = ss.getSheetByName('orderz');
    var sellerSheet = ss.getSheetByName('seller');
    if (!sheet) return jsonResponse({error:'No orderz sheet'});
    if (!sellerSheet) return jsonResponse({error:'No seller sheet'});
    // Validate stock availability
    var sellerData = sellerSheet.getDataRange().getValues();
    var stockMap = {};
    for (var i = 1; i < sellerData.length; i++) {
      // columns: itemId, name, price, stock
      stockMap[sellerData[i][0]] = {row: i+1, stock: Number(sellerData[i][3]), name: sellerData[i][1]};
    }
    var items = order.items || {};
    var insufficient = [];
    for (var id in items) {
      var qty = Number(items[id].qty || 0);
      var s = stockMap[id];
      var available = s ? s.stock : 0;
      var name = s ? s.name : id;
      if (qty > available) insufficient.push({itemId: id, name: name, requested: qty, available: available});
    }
    if (insufficient.length > 0) {
      return jsonResponse({error: 'Insufficient stock', details: insufficient});
    }
    // All good: append order and decrement stock
    var orderId = 'ORD-' + (sheet.getLastRow());
    var now = new Date();
    var row = [orderId, now.toISOString(), order.customerName, JSON.stringify(order.items), order.totalAmount, 0, '', false];
    sheet.appendRow(row);
    // update seller stock
    var updatedStocks = {};
    for (var id2 in items) {
      var qty2 = Number(items[id2].qty || 0);
      var s2 = stockMap[id2];
      if (s2) {
        var newStock = s2.stock - qty2;
        sellerSheet.getRange(s2.row, 4).setValue(newStock);
        updatedStocks[id2] = {name: s2.name, stock: newStock};
      }
    }
    return jsonResponse({success:true, orderId: orderId, updatedStocks: updatedStocks});
  }
  if (action === 'confirmPayment') {
    var orderId = e.orderId;
    var method = e.method || 'manual'; // รับ method จาก frontend
    var sheet = ss.getSheetByName('orderz');
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == orderId) {
        sheet.getRange(i+1, 6).setValue(data[i][4]); // paidAmount = totalAmount
        sheet.getRange(i+1, 8).setValue(true); // paid = TRUE
        sheet.getRange(i+1, 7).setValue(JSON.stringify([{date:new Date().toISOString(),amount:data[i][4],method:method}])); // ใช้ method ที่รับมา
        return jsonResponse({success:true});
      }
    }
    return jsonResponse({error:'Order not found'});
  }
  if (action === 'updateStock') {
    var itemId = e.itemId;
    var delta = Number(e.delta)||0;
    var sheet = ss.getSheetByName('seller');
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == itemId) {
        var newStock = Number(data[i][3]) + delta;
        sheet.getRange(i+1, 4).setValue(newStock);
        return jsonResponse({success:true, stock:newStock});
      }
    }
    return jsonResponse({error:'Item not found'});
  }
  if (action === 'saveProduct') {
    var p = e.product;
    var sheet = ss.getSheetByName('seller');
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == p.itemId) {
        sheet.getRange(i+1, 2, 1, 3).setValues([[p.name, p.price, p.stock]]);
        return jsonResponse({success:true});
      }
    }
    sheet.appendRow([p.itemId, p.name, p.price, p.stock]);
    return jsonResponse({success:true});
  }
  // Update sending_status (column I) by orderId
  if (action === 'updateOrderSendingStatus') {
    var orderIdS = e.orderId;
    var status = e.status || 'not';
    var sheetS = ss.getSheetByName('orderz');
    if (!sheetS) return jsonResponse({error:'No orderz sheet'});
    var dataS = sheetS.getDataRange().getValues();
    for (var iS = 1; iS < dataS.length; iS++) {
      if (dataS[iS][0] == orderIdS) {
        sheetS.getRange(iS+1, 9).setValue(status); // I column
        return jsonResponse({success:true});
      }
    }
    return jsonResponse({error:'Order not found'});
  }
  // Update place_sent (column J) by orderId
  if (action === 'updateOrderPlace') {
    var orderIdP = e.orderId;
    var place = e.place || 'hand';
    var sheetP = ss.getSheetByName('orderz');
    if (!sheetP) return jsonResponse({error:'No orderz sheet'});
    var dataP = sheetP.getDataRange().getValues();
    for (var iP = 1; iP < dataP.length; iP++) {
      if (dataP[iP][0] == orderIdP) {
        sheetP.getRange(iP+1, 10).setValue(place); // J column
        return jsonResponse({success:true});
      }
    }
    return jsonResponse({error:'Order not found'});
  }
  return jsonResponse({error:'Unknown action'});
}

function getSheetData(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var hdr = data[0];
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < hdr.length; j++) {
      row[hdr[j]] = data[i][j];
    }
    out.push(row);
  }
  return out;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Deployment instructions:
 * 1. Open Google Apps Script editor (script.google.com)
 * 2. Create a new project, paste this file as Code.gs
 * 3. Set permissions: SpreadsheetApp access
 * 4. Deploy as web app: New deployment > Web app > Execute as Me, access: Anyone
 * 5. Use the web app URL in your frontend (already set in app.js)
 * 6. Make sure your Google Sheet has two sheets named 'seller' and 'orderz' with matching columns
 */
