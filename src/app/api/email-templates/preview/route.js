import { NextResponse } from 'next/server';
import { replaceVariables } from '@/lib/template-utils';
import nodemailer from 'nodemailer';

// POST - Preview template with sample data
export async function POST(req) {
    try {
        const { html_content, subject_line, template_type, send_test_email, test_email } = await req.json();

        if (!html_content || !subject_line || !template_type) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Sample data for different template types
        const sampleData = {
            INSTALLATION: {
                service_id: '12345',
                customer_name: 'John Doe',
                product_name: 'Industrial Vacuum Cleaner Model XYZ',
                model: 'XYZ-2000',
                serial_number: 'SN-2024-001234',
                site_person: 'Jane Smith',
                site_email: 'jane.smith@example.com',
                site_contact: '+91 9876543210',
                installation_address: '123 Industrial Area, Block A, New Delhi - 110001',
                service_type: 'INSTALLATION',
                current_year: new Date().getFullYear(),
            },
            SERVICE_COMPLETION: {
                service_id: '67890',
                serial_number: 'SN-2024-005678',
                location: '456 Factory Road, Sector 18, Noida - 201301',
                installed_address: '456 Factory Road, Sector 18, Noida - 201301',
                completion_remark: 'All parts cleaned and serviced. Equipment working perfectly.',
                completed_date: new Date().toISOString().split('T')[0],
                feedback_link: 'http://localhost:3000/feedback/67890',
                current_year: new Date().getFullYear(),
            },
            COMPLAINT: {
                service_id: '24680',
                complaint_date: new Date().toISOString().split('T')[0],
                service_type: 'WARRANTY',
                serial_number: 'SN-2024-009999',
                location: '789 Business Park, Gurgaon - 122001',
                complaint_summary: 'Machine making unusual noise during operation',
                assigned_to: 'Rajesh Kumar',
                status: 'ASSIGNED',
                current_year: new Date().getFullYear(),
            },
        };

        // Get sample data for the template type
        const data = sampleData[template_type] || sampleData.INSTALLATION;

        // Replace variables in both subject and HTML
        const processedSubject = replaceVariables(subject_line, data);
        const processedHtml = replaceVariables(html_content, data);

        // If test email is requested, send it
        if (send_test_email && test_email) {
            try {
                const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: Number(process.env.SMTP_PORT),
                    secure: Number(process.env.SMTP_PORT) === 465,
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS,
                    },
                });

                await transporter.sendMail({
                    from: `"Dynaclean Industries - TEST" <${process.env.SMTP_USER}>`,
                    to: test_email,
                    subject: `[TEST] ${processedSubject}`,
                    html: `
            <div style="background-color: #fff3cd; border: 2px solid #ffc107; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
              <strong>⚠️ TEST EMAIL</strong><br>
              This is a test email from the Email Template System. Sample data is used for demonstration purposes.
            </div>
            ${processedHtml}
          `,
                });

                return NextResponse.json({
                    success: true,
                    processedSubject,
                    processedHtml,
                    testEmailSent: true,
                    message: `Test email sent to ${test_email}`,
                });
            } catch (emailError) {
                console.error('Error sending test email:', emailError);
                return NextResponse.json({
                    success: true,
                    processedSubject,
                    processedHtml,
                    testEmailSent: false,
                    emailError: emailError.message,
                });
            }
        }

        return NextResponse.json({
            success: true,
            processedSubject,
            processedHtml,
            sampleData: data,
        });
    } catch (error) {
        console.error('Error previewing template:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to preview template' },
            { status: 500 }
        );
    }
}
