import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET(request, context) {
  try {
    const { params } = context;
    const serviceId = params.service_id;

    if (!serviceId) {
      return NextResponse.json(
        { error: "Service ID is required" },
        { status: 400 }
      );
    }

    const db = await getDbConnection();

    // Fetch the main service record to get the serial_number
    const [serviceRecords] = await db.query(
      "SELECT serial_number, complaint_number, service_type, status, reg_date, completed_date, pdf_path FROM service_records WHERE service_id = ?",
      [serviceId]
    );

    const serviceRecord = serviceRecords[0];

    if (!serviceRecord) {
      return NextResponse.json(
        { error: "Service record not found" },
        { status: 404 }
      );
    }

const oldStatus = "PENDING FOR SPARES"
    

        const [installationRows] = await db.query(
      "SELECT * FROM installation_reports WHERE service_id = ? and status = ?",
      [serviceId, oldStatus]
    );

    const installationData = installationRows.length > 0 ? installationRows[0] : null;

       console.log("------------------------------------------------------------------------------------------");
    console.log("------------------------------------------------------------------------------------------");
    console.log("------------------------------------------------------------------------------------------");
    console.log("service ID:", serviceId);
    console.log("service STATUS:", serviceRecord.status);
    
    

    console.log("this is the ddta afior the installation record:",installationRows);

    const serialNumber = serviceRecord.serial_number;

    // Fetch detailed reports
    const [serviceReports] = await db.query(
      "SELECT * FROM service_reports WHERE service_id = ?",
      [serviceId]
    );

    // Fetch warranty product details using the serial_number
    const [warrantyProducts] = await db.query(
      "SELECT product_name, model, customer_name, email, contact, customer_address, installed_address, installation_date, invoice_number, invoice_date FROM warranty_products WHERE serial_number = ?",
      [serialNumber]
    );

    const warrantyProduct = warrantyProducts[0] || {};

    return NextResponse.json({
      reports: serviceReports,
      record: serviceRecord,
      product: warrantyProduct,
      install: installationData,
    });
  } catch (error) {
    console.error("Error fetching service record:", error);
    return NextResponse.json(
      { error: "Failed to fetch service record" },
      { status: 500 }
    );
  }
}