// // app/api/orders/upload-booking/route.js
// import { NextResponse } from "next/server";
// import { getDbConnection } from "@/lib/db";

// export async function POST(req) {
//   try {
//     const body = await req.json();
//     const {
//       orderId,
//       quote,
//       booking_id,
//       booking_date,
//       taskassignto,
//       booking_url,
//       adminremark,
//     } = body;

//     if (!orderId || !booking_id || !booking_date || !taskassignto || !booking_url) {
//       return NextResponse.json({ error: "Missing fields" }, { status: 400 });
//     }

//     const conn = await mysql.createConnection({
//       host: process.env.DB_HOST,
//       user: process.env.DB_USER,
//       password: process.env.DB_PASS,
//       database: process.env.DB_NAME,
//     });

//     const [result] = await conn.execute(
//       `UPDATE neworder SET 
//         booking_url = ?, 
//         booking_id = ?, 
//         booking_date = ?, 
//         admin_status = ?, 
//         dispatch_person = ?, 
//         admin_remark = ?
//        WHERE order_id = ?`,
//       [booking_url, booking_id, booking_date, 1, taskassignto, adminremark, orderId]
//     );

//         // await conn.end();
//     return NextResponse.json({ success: true });
//   } catch (error) {
//     console.error("❌ Booking Upload Error:", error);
//     return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
//   }
// }





import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      orderId,
      quote,
      booking_id,
      booking_date,
      taskassignto,
      booking_url,
      adminremark,
      godown,
    } = body;

    if (!orderId || !booking_id || !booking_date || !taskassignto || !booking_url) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    
console.log('This is the correct we should get orderId:', orderId);

    const conn = await getDbConnection();

    // ✅ Step 1: Update neworder table with booking info
    await conn.execute(
      `UPDATE neworder SET 
        booking_url = ?, 
        booking_id = ?, 
        booking_date = ?, 
        admin_status = ?, 
        dispatch_person = ?, 
        admin_remark = ?
       WHERE order_id = ?`,
      [booking_url, booking_id, booking_date, 1, taskassignto, adminremark, orderId]
    );

    // ✅ Step 2: Get all item_codes + quantities for the quote
    const [items] = await conn.execute(
      `SELECT item_code, quantity, total_price, hsn_sac  FROM quotation_items WHERE quote_number = ?`,
      [quote]
    );


        const [moreitems] = await conn.execute(
      `SELECT company_name, company_address, gstin  FROM quotations_records WHERE quote_number = ?`,
      [quote]
    );

     let locationColumn = godown === "Delhi - Mundka" ? "Delhi" : "South";

for (const item of items) {
  const { item_code, quantity, total_price, hsn_sac } = item;
  const { company_name, company_address, gstin } = moreitems[0];

  // Check if item_code contains any letters
  const isProduct = /[a-zA-Z]/.test(item_code);

  if (isProduct) {
    // This code block runs if the item_code has letters (e.g., product)
    // 🔻 Insert a new OUT record into product_stock



const [rows] = await conn.execute(
  `SELECT total, delhi, south FROM product_stock 
   WHERE product_code = ? 
   ORDER BY created_at DESC 
   LIMIT 1`,
  [item_code]
);

// Initialize base values
let totalDB = 0;
let delhiDB = 0;
let southDB = 0;

if (rows.length > 0) {
  totalDB = rows[0].total ;
  delhiDB = rows[0].delhi ;
  southDB = rows[0].south ;
}

// 2. Compute updated values

let delhiD = delhiDB;
let southD = southDB;

if (godown === "Delhi - Mundka") {
  delhiD = delhiDB - quantity;
  southD = southDB;
} else {
  southD = southDB - quantity;
  delhiD = delhiDB;
}

let totalD = totalDB - quantity;








    await conn.execute(
      `INSERT INTO product_stock 
        (product_code, quantity, amount_per_unit, net_amount, note, location, stock_status, gst, hs_code, to_company, delivery_address, quotation_id, order_id, godown, total, delhi, south)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item_code,
        quantity,
        total_price,
        total_price,
        "Auto-dispatch",
        "Dispatch",
        "OUT",
        gstin,
        hsn_sac,
        company_name,
        company_address,
        quote,
        orderId,
        godown, 
        totalD,
        delhiD, 
        southD
      ]
    );


    
    // 🔻 Get current total quantity from summary
   const [summary] = await conn.execute(
  `SELECT total_quantity, ${locationColumn} FROM product_stock_summary WHERE product_code = ?`,
  [item_code]
);


    if (summary.length > 0) {

      const prevTotal = summary[0].total_quantity;
      const newTotal = Math.max(prevTotal - quantity, 0);
  const prev = summary[0][locationColumn];  // This will be either "Delhi" or "South"
  const newv = Math.max(prev - quantity, 0);

      // 🔻 Update the summary table
      await conn.execute(
        `UPDATE product_stock_summary 
          SET last_updated_quantity = ?, total_quantity = ?, last_status = ?, updated_at = NOW(), ${locationColumn} = ?
          WHERE product_code = ?`,
        [quantity, newTotal, "OUT",newv, item_code]
      );
    }
  } else {
    // This code block runs if the item_code has only numbers (e.g., spare part)
    // 🔻 Insert a new OUT record into spare_stock



const [rows] = await conn.execute(
  `SELECT total, delhi, south FROM stock_list
   WHERE spare_id = ? 
   ORDER BY created_at DESC 
   LIMIT 1`,
  [item_code]
);

// Initialize base values
let totalDB = 0;
let delhiDB = 0;
let southDB = 0;

if (rows.length > 0) {
  totalDB = rows[0].total ;
  delhiDB = rows[0].delhi ;
  southDB = rows[0].south ;
}

// 2. Compute updated values

let delhiD = delhiDB;
let southD = southDB;

if (godown === "Delhi - Mundka") {
  delhiD = delhiDB - quantity;
  southD = southDB;
} else {
  southD = southDB - quantity;
  delhiD = delhiDB;
}

let totalD = totalDB - quantity;






    await conn.execute(
      `INSERT INTO stock_list
        (spare_id, quantity, amount_per_unit, net_amount, note, location, stock_status, to_company, delivery_address, quotation_id, order_id, godown, total, delhi, south)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item_code,
        quantity,
        total_price,
        total_price,
        "Auto-dispatch",
        "Dispatch",
        "OUT",
        company_name,
        company_address,
        quote,
        orderId,
        godown,
        totalD,
        delhiD, 
        southD
      ]
    );

    // 🔻 Get current total quantity from summary
    const [summary] = await conn.execute(
      `SELECT total_quantity, ${locationColumn} FROM stock_summary WHERE spare_id = ?`,
      [item_code]
    );

    if (summary.length > 0) {
      const prevTotal = summary[0].total_quantity;
      const newTotal = Math.max(prevTotal - quantity, 0);
  const prev = summary[0][locationColumn];  // This will be either "Delhi" or "South"
  const newv = Math.max(prev - quantity, 0);

      // 🔻 Update the summary table
      await conn.execute(
        `UPDATE stock_summary 
          SET last_updated_quantity = ?, total_quantity = ?, last_status = ?, updated_at = NOW(), ${locationColumn} = ?
          WHERE spare_id = ?`,
        [quantity, newTotal, "OUT",newv, item_code]
      );
    }
  }
}




        // await conn.end();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Booking Upload Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
