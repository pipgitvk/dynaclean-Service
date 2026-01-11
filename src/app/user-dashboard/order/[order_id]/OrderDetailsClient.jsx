"use client";

import { useMemo } from "react";

const stages = [
  "Sales",
  "Account",
  "Admin",
  "Dispatch",
  "Installation Report",
  "Complete",
];

export default function OrderDetailsClient({
  orderDetails,
  items,
  statuses,
  orderId,
}) {
  const { totalQty, totalTaxable, totalGst, totalAmount } = useMemo(() => {
    let totalQty = 0,
      totalTaxable = 0,
      totalGst = 0,
      totalAmount = 0;

    items.forEach((item) => {
      totalQty += Number(item.quantity || 0);
      totalTaxable += Number(item.taxable_price || 0);
      totalGst += Number(item.gst || 0);
      totalAmount += Number(item.total_price || 0);
    });

    return { totalQty, totalTaxable, totalGst, totalAmount };
  }, [items]);

  const currentStage = useMemo(() => {
    const statusList = [
      statuses?.sales_status,
      statuses?.account_status,
      statuses?.admin_status,
      statuses?.dispatch_status,
      statuses?.installation_status,
    ];

    if (!statusList.includes(0)) return "Complete";

    const index = statusList.findIndex((s) => s === 0);
    return stages[index] || "Sales";
  }, [statuses]);

  const currentIndex = stages.indexOf(currentStage);
  const progressPercent = (currentIndex / (stages.length - 1)) * 100;

  return (
    <div className="p-4 space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="relative w-full h-3 bg-gray-300 rounded-full">
          <div
            className="absolute top-0 left-0 h-3 bg-blue-600 rounded-full"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs sm:text-sm">
          {stages.map((stage, i) => (
            <div key={i} className="text-center flex-1">
              <div
                className={`w-6 h-6 mx-auto mb-1 rounded-full text-white text-xs flex items-center justify-center ${
                  i <= currentIndex ? "bg-blue-600" : "bg-gray-400"
                }`}
              >
                {i + 1}
              </div>
              <div>{stage}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Quotation Number" value={orderDetails.quote_number} />
        <Input label="Company Name" value={orderDetails.company_name} />
        <Input label="Company Address" value={orderDetails.company_address} />
        <Input label="State" value={orderDetails.state} />
        <Input label="Ship To" value={orderDetails.ship_to} />
        <Input label="Client Name" value={orderDetails.client_name} />
        <Input label="Contact Number" value={orderDetails.contact} />
        <Input label="Email" value={orderDetails.email} />
        <Input
          label="Delivery Location"
          value={orderDetails.delivery_location}
        />
        <TextArea label="Remark" value={orderDetails.sales_remark} />
      </div>

      {/* Items Table / Card */}
      <div className="space-y-4">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full border text-sm text-center">
            <thead className="bg-gray-100 text-gray-700 uppercase text-sm">
              <tr>
                <th>#</th>
                <th>Image</th>
                <th>Item Name</th>
                <th>Item Code</th>
                <th>Specification</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Price/Unit</th>
                <th>Taxable</th>
                <th>GST</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item, idx) => (
                  <tr key={idx} className="bg-white hover:bg-gray-50">
                    <td>{idx + 1}</td>
                    <td>
                      <img
                        src={item.img_url}
                        alt="Item"
                        className="h-10 w-10 object-contain mx-auto rounded"
                      />
                    </td>
                    <td>{item.item_name}</td>
                    <td>{item.item_code}</td>
                    <td>{item.specification}</td>
                    <td>{item.quantity}</td>
                    <td>{item.unit}</td>
                    <td>₹{Number(item.price_per_unit).toFixed(2)}</td>
                    <td>₹{Number(item.taxable_price).toFixed(2)}</td>
                    <td>₹{Number(item.gst).toFixed(2)}</td>
                    <td>₹{Number(item.total_price).toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="11"
                    className="text-center text-gray-500 italic py-4"
                  >
                    No items found.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-gray-100 font-semibold text-sm">
              <tr>
                <td colSpan="5" className="text-right px-4 py-2">
                  Total
                </td>
                <td>{totalQty}</td>
                <td></td>
                <td></td>
                <td>₹{totalTaxable.toFixed(2)}</td>
                <td>₹{totalGst.toFixed(2)}</td>
                <td>₹{totalAmount.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="border rounded-md p-4 shadow-sm bg-white space-y-1"
            >
              <div className="flex items-center gap-4">
                <img
                  src={item.img_url}
                  alt="Item"
                  className="h-12 w-12 object-contain rounded"
                />
                <div>
                  <p className="font-semibold">{item.item_name}</p>
                  <p className="text-sm text-gray-500">{item.item_code}</p>
                </div>
              </div>
              <p>
                <strong>Specification:</strong> {item.specification}
              </p>
              <p>
                <strong>Qty:</strong> {item.quantity} {item.unit}
              </p>
              <p>
                <strong>Price/Unit:</strong> ₹
                {Number(item.price_per_unit).toFixed(2)}
              </p>
              <p>
                <strong>Taxable:</strong> ₹
                {Number(item.taxable_price).toFixed(2)}
              </p>
              <p>
                <strong>GST:</strong> ₹{Number(item.gst).toFixed(2)}
              </p>
              <p>
                <strong>Total:</strong> ₹{Number(item.total_price).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Files */}
      <FileSection label="Purchase Order" file={orderDetails.po_file} />
      <FileSection label="Payment Proof" file={orderDetails.payment_proof} />
      <FileSection label="Invoice" file={orderDetails.report_file} />

      {/* Back Link */}
      <div className="text-center mt-6">
        <a
          href="/user-dashboard/order"
          className="inline-block bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded"
        >
          ← Back to Order List
        </a>
      </div>
    </div>
  );
}

function Input({ label, value }) {
  return (
    <div>
      <label className="block font-medium text-sm mb-1">{label}:</label>
      <input
        type="text"
        value={value || ""}
        readOnly
        className="w-full border px-3 py-2 rounded"
      />
    </div>
  );
}

function TextArea({ label, value }) {
  return (
    <div className="col-span-full">
      <label className="block font-medium text-sm mb-1">{label}:</label>
      <textarea
        readOnly
        value={value || ""}
        className="w-full border px-3 py-2 rounded"
        rows="3"
      />
    </div>
  );
}

function FileSection({ label, file }) {
  if (!file)
    return <p className="text-gray-500 mb-2 italic">No {label} uploaded.</p>;

  return (
    <div className="mb-4">
      <p className="font-semibold">{label}:</p>
      <a
        href={file}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 underline mr-4"
      >
        🔍 View
      </a>
      <a href={file} download className="text-blue-500 underline">
        ⬇ Download
      </a>
    </div>
  );
}
