"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import dayjs from "dayjs";
import { generateServiceReportPDF, downloadPDF } from "@/utils/pdfGenerator";
import "./print.css";

const CHECKLIST_ITEMS = [
  "Voltage (V)",
  "Condition of Motor",
  "Check Squeegee blades / Adjust",
  "Amperages (Amps)",
  "Greasing Cleaned / Done",
  "Condition of Handle",
  "Switches Checked",
  "Filters Cleaned / Checked",
  "Condition of Wheels",
  "Condition of Elec Cable",
  "Condition of Belt",
  "Check Oil / TOP UP Done",
  "Fuse Checked",
  "Condition of Coupling / Drive Disk",
  "Check Battery Condition / Electrolyte",
  "Condition of Carbon Brush",
  "Condition of Rubber Brush",
  "Check Brush Condition",
];

const formatDate = (date) => {
  return date ? dayjs(date).format("YYYY-MM-DD") : "-";
};

export default function ViewServiceReport({ params }) {
  const [report, setReport] = useState(null);
  const [records, setRecords] = useState(null);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [install, setInstall] = useState({});
  const [trainees, setTrainees] = useState([]);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/service-records-old/${params.service_id}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        setReport(data.reports[0] || {});
        setRecords(data.record || {});
        setDetails(data.product || {});
        setInstall(data.install || {});
        if (data.install) {
          const transformedTrainees = transformTraineeData(data.install);
          setTrainees(transformedTrainees);
        }
        console.log("this is the data we have", data);
      } catch (error) {
        console.error("Failed to fetch report:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [params.service_id]);

  const transformTraineeData = (installData) => {
    const names = installData.trainee_names
      ? installData.trainee_names.split(",")
      : [];
    const designations = installData.trainee_departments
      ? installData.trainee_departments.split(",")
      : [];
    const contacts = installData.trainee_contacts
      ? installData.trainee_contacts.split(",")
      : [];

    const traineesArray = [];
    for (let i = 0; i < names.length; i++) {
      traineesArray.push({
        id: i, // Use index as a temporary key if no unique ID is available
        name: names[i] ? names[i].trim() : "",
        designation: designations[i] ? designations[i].trim() : "",
        contact: contacts[i] ? contacts[i].trim() : "",
      });
    }
    return traineesArray;
  };

  const handlePrint = () => {
    const printContent = document
      .getElementById("print-content")
      .cloneNode(true);
    const printWindow = window.open("", "_blank", "height=600,width=800");
    printWindow.document.write("<html><head><title>Service Report</title>");
    const styles = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return sheet.cssRules
            ? Array.from(sheet.cssRules)
                .map((rule) => rule.cssText)
                .join("")
            : "";
        } catch (e) {
          return "";
        }
      })
      .join("");
    printWindow.document.write("<style>" + styles + "</style>");
    printWindow.document.write("</head><body>");
    printWindow.document.write(printContent.outerHTML);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  const handleDownloadPDF = async () => {
    if (!report || !details) return;

    setIsGeneratingPDF(true);
    try {
      const pdfData = {
        service_id: report.service_id,
        serial_number: records.serial_number,
        status: records.status,
        complaint_date: report.service_date,
        complaint_number: records.complaint_number,
        service_type: records.service_type,
        reg_date: records.reg_date,
        completed_date: records.completed_date,
        checklist: report.checklist,
        nature_of_complaints: report.nature_of_complaint,
        observation: report.observation,
        action_taken: report.action_taken,
        complaint_summary: report.complaint_summary,
        completion_remark: report.completion_remark,
        replaced: report.spare_replaced,
        to_be_replaced: report.spare_to_be_replaced,
        service_rate: report.service_rating,
        feedback: report.customer_feedback,
        authorised_person_name: report.authorized_person_name,
        authorised_person_designation: report.authorized_person_designation,
        authorised_person_mobile: report.authorized_person_mobile,
        authorised_person_sign: report.authorized_person_sign,
        customer_name: report.customer_name1,
        customer_designation: report.customer_designation,
        customer_mobile: report.customer_mobile,
        customer_sign: report.customer_sign,
      };

      const productData = {
        product_name: details.product_name,
        model: details.model,
        customer_name: details.customer_name,
        email: details.email,
        contact: details.contact,
        customer_address: details.customer_address,
        installed_address: details.installed_address,
        installation_date: details.installation_date,
        invoice_number: details.invoice_number,
        invoice_date: details.invoice_date,
      };

      let installData = null;
      if (records.service_type === "INSTALLATION" && install) {
        installData = {
          defects_on_inspection: install.defects_on_inspection,
          engineer_remarks: install.engineer_remarks,
        };
      }

      const pdf = await generateServiceReportPDF(pdfData, productData, installData, trainees);
      const filename = `Service_Report_${report.service_id}_${dayjs().format('YYYY-MM-DD')}.pdf`;
      
      downloadPDF(pdf, filename);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-lg">
        Loading report...
      </div>
    );
  }

  if (!report || Object.keys(report).length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500 font-semibold">
        Report not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-2 sm:p-4 md:p-8 flex items-center justify-center">
      <div className="bg-white border border-gray-200 shadow-xl rounded-lg p-4 sm:p-6 w-full md:max-w-6xl">
        <div id="print-content">
          {/* Header */}
          <header className="flex flex-col sm:flex-row items-center justify-between mb-4 sm:mb-8 pb-2 sm:pb-4 border-b-2 border-gray-200 text-center sm:text-left">
            <div className="mb-2 sm:mb-0 sm:w-1/4 flex-shrink-0">
              <Image
                src="/images/logo.png"
                alt="Dynaclean Industries Logo"
                width={120}
                height={120}
                className="mx-auto sm:mx-0"
              />
            </div>
            <div className="sm:w-3/4">
              <h1 className="text-xl sm:text-3xl font-bold text-red-700">
                DYNACLEAN INDUSTRIES
              </h1>
              <address className="not-italic text-xs sm:text-sm text-gray-600 mt-1 sm:mt-2">
                1ST Floor, 13-B, Kattabomman Street, Gandhi Nagar Main Road,
                Gandhi Nagar, Ganapathy, Coimbatore, Tamil Nadu, Pin: 641006.
              </address>
              <div className="text-xs sm:text-sm text-gray-600 mt-1 sm:mt-2">
                <p>
                  Email:{" "}
                  <a
                    href="mailto:service@dynacleanindustries.com"
                    className="text-blue-600 hover:underline"
                  >
                    service@dynacleanindustries.com
                  </a>
                  ,{" "}
                  <a
                    href="mailto:sales@dynacleanindustries.com"
                    className="text-blue-600 hover:underline"
                  >
                    sales@dynacleanindustries.com
                  </a>
                </p>
                <p>Phone: 011-45143666, +91-9205551085, +91-7982456944</p>
              </div>
            </div>
          </header>

          {/* Report Title */}
          <h2 className="text-2xl sm:text-3xl font-bold text-center my-4 sm:my-6 service-report-title">
            Service Report
          </h2>

          {/* Combined Details Grid (Responsive) */}
          <div className="mb-6 p-4 border rounded-md bg-gray-50">
            <h3 className="text-lg font-semibold mb-3">
              PRODUCT & CUSTOMER DETAILS
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-6">
              <ReadRow label="Service ID" value={report.service_id} />
              <ReadRow label="Product Name" value={details.product_name} />
              <ReadRow label="Model" value={details.model} />
              <ReadRow
                label="Complaint Number"
                value={records.complaint_number}
              />
              <ReadRow label="Service Type" value={records.service_type} />
              <ReadRow label="Serial Number" value={records.serial_number} />
              <ReadRow label="Status" value={records.status} />
              <ReadRow label="Customer Name" value={details.customer_name} />
              <ReadRow label="Contact" value={details.contact} />
              <ReadRow
                label="Service Date"
                value={formatDate(report.service_date)}
              />
              <ReadRow label="Invoice Number" value={details.invoice_number} />
              <ReadRow
                label="Invoice Date"
                value={formatDate(details.invoice_date)}
              />
              <ReadRow
                label="Registration Date"
                value={formatDate(records.reg_date)}
              />
              <ReadRow
                label="Installation Date"
                value={formatDate(details.installation_date)}
              />
              <ReadRow
                label="Completed Date"
                value={formatDate(records.completed_date)}
              />
              <ReadRow
                label="Customer Address"
                value={details.customer_address}
              />
              <ReadRow
                label="Installed Address"
                value={details.installed_address}
              />
              <ReadRow label="Email" value={details.email} />
            </div>
          </div>

          {/* Checklist */}
          <div className="mb-6 p-4 border rounded-md bg-gray-50">
            <h3 className="text-lg font-semibold mb-3">
              CHECKLIST (OK / NOT OK / NA)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs sm:text-sm">
              {CHECKLIST_ITEMS.map((item, index) => (
                <div key={index} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={report.checklist?.split(",").includes(item)}
                    readOnly
                    className="mr-2 h-4 w-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* this is the new last  */}
          {records.service_type === "INSTALLATION" && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Defects Found on Inspection
                </label>
                <p className="w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-900 bg-gray-50 break-words">
                  {install.defects_on_inspection || "N/A"}
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Engineer's Remark
                </label>
                <p className="w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-900 bg-gray-50 break-words">
                  {install.engineer_remarks || "N/A"}
                </p>
              </div>
              <div className=" mx-auto bg-white shadow-xl rounded-lg p-4 sm:p-6 mt-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  Trainees Present
                </h3>
                <div className="overflow-x-auto">
                  <table
                    className="min-w-full text-left border-collapse"
                    id="traineesTable"
                  >
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="p-2 sm:p-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300 rounded-tl-lg">
                          S. No.
                        </th>
                        <th className="p-2 sm:p-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                          Name of Trainees
                        </th>
                        <th className="p-2 sm:p-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                          Designation
                        </th>
                        <th className="p-2 sm:p-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300 rounded-tr-lg">
                          Contact No.
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainees.length > 0 ? (
                        trainees.map((trainee, index) => (
                          <tr
                            key={trainee.id || index}
                            className="border-b border-gray-200 hover:bg-gray-100 transition-colors duration-200"
                          >
                            <td className="p-2 sm:p-3 text-gray-600">
                              {index + 1}
                            </td>
                            <td className="p-2 sm:p-3 text-gray-800">
                              {trainee.name}
                            </td>
                            <td className="p-2 sm:p-3 text-gray-800">
                              {trainee.designation}
                            </td>
                            <td className="p-2 sm:p-3 text-gray-800">
                              {trainee.contact}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan="4"
                            className="p-4 text-center text-gray-500"
                          >
                            No trainees recorded for this installation.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
          {/* this is the new information */}

          {/* Service Rendered */}
          <div className="mb-6 p-4 border rounded-md bg-gray-50 service-rendered">
            <h3 className="text-lg font-semibold mb-3">SERVICE RENDERED</h3>
            <div className="grid grid-cols-1 gap-4">
              <ReadRow
                label="Nature of Complaint"
                value={report.nature_of_complaint}
              />
              <ReadRow label="Observation" value={report.observation} />
              <ReadRow label="Action Taken" value={report.action_taken} />
            </div>
          </div>

          {/* Spare Parts (Responsive) */}
          <div className="mb-6 p-4 border rounded-md">
            <h3 className="text-lg font-semibold mb-3">SPARE PARTS DETAILS</h3>
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider font-bold">
                      S. No.
                    </th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider font-bold">
                      REPLACED
                    </th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider font-bold">
                      TO BE REPLACED
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 text-sm">1</td>
                    <td className="px-6 py-4 text-sm">
                      {report.spare_replaced || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {report.spare_to_be_replaced || "-"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Mobile-friendly view for spare parts */}
            <div className="md:hidden">
              <div className="grid grid-cols-1 gap-4">
                <ReadRow
                  label="Replaced"
                  value={report.spare_replaced || "-"}
                />
                <ReadRow
                  label="To Be Replaced"
                  value={report.spare_to_be_replaced || "-"}
                />
              </div>
            </div>

            <div className="mt-6 feedback-table grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ReadRow label="Service Rating" value={report.service_rating} />
              <ReadRow
                label="Customer Feedback"
                value={report.customer_feedback}
              />
            </div>
          </div>

          {/* Signatures (Responsive) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6 signature-section">
            <div>
              <h3 className="text-lg font-semibold mb-3">
                Authorized Person (Engineer)
              </h3>
              {report.authorized_person_sign && (
                <img
                  src={`/signatures/${report.authorized_person_sign}`}
                  alt="Engineer Signature"
                  className="w-full h-auto object-contain border border-gray-300 rounded-md mb-4"
                />
              )}
              <ReadRow
                label="Name"
                value={report.authorized_person_name || "N/A"}
              />
              <ReadRow
                label="Designation"
                value={report.authorized_person_designation}
              />
              <ReadRow label="Mobile" value={report.authorized_person_mobile} />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Customer</h3>
              {report.customer_sign && (
                <img
                  src={`/signatures/${report.customer_sign}`}
                  alt="Customer Signature"
                  className="w-full h-auto object-contain border border-gray-300 rounded-md mb-4"
                />
              )}
              <ReadRow label="Name" value={report.customer_name || "N/A"} />
              <ReadRow
                label="Designation"
                value={report.customer_designation}
              />
              <ReadRow label="Mobile" value={report.customer_mobile} />
            </div>
          </div>
        </div>

        {/* Print and Download Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center sm:justify-end mt-8 no-print">
          <button
            type="button"
            onClick={handlePrint}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-md shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
          >
            Print Report
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white font-semibold rounded-md shadow-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isGeneratingPDF ? "Generating PDF..." : "Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

const ReadRow = ({ label, value }) => (
  <div className="flex flex-col">
    <label className="text-xs sm:text-sm font-medium text-gray-600">
      {label}:
    </label>
    <p className="text-sm sm:text-base text-gray-900 font-medium">
      {value || "-"}
    </p>
  </div>
);
