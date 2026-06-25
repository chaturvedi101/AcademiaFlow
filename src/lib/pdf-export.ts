
'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Syllabus, Scheme, Program } from './types';

const PRIMARY_COLOR = [77, 26, 140]; // #4D1A8C
const ACCENT_COLOR = [61, 143, 255]; // #3D8FFF

/**
 * Generates and downloads a professional PDF document for a single subject syllabus.
 */
export const exportSyllabusToPDF = (
  syllabus: Partial<Syllabus>, 
  programName: string = 'N/A', 
  branch: string = 'General', 
  batchYear: string = 'N/A'
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // RTU Logo Placement (Simulated with text branding if remote fetch is restricted in PDF context)
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text('RAJASTHAN TECHNICAL UNIVERSITY, KOTA', pageWidth / 2, 15, { align: 'center' });
  
  // Header - Institution Title
  doc.setFontSize(18);
  doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Academia Flow | Syllabus Specification', pageWidth / 2, 25, { align: 'center' });
  
  // Scheme Info Header
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text(`${programName} (${branch})`, pageWidth / 2, 32, { align: 'center' });
  doc.text(`Batch: ${batchYear} | RTU-NEP Framework Compliance`, pageWidth / 2, 37, { align: 'center' });

  // Subject Branding Strip
  doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.rect(15, 42, pageWidth - 30, 10, 'F');
  doc.setTextColor(255);
  doc.setFontSize(11);
  doc.text(`COURSE CODE: ${syllabus.subjectCode || 'CODE'} - ${syllabus.title?.toUpperCase() || 'TITLE'}`, 20, 48.5);

  // Basic Info Grid
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Credit Distribution:', 15, 62);
  doc.setFont('helvetica', 'normal');
  doc.text(`L-T-P: ${syllabus.lectureCredits || 0}-${syllabus.tutorialCredits || 0}-${syllabus.practicalCredits || 0}`, 15, 67);
  doc.text(`Total Credits: ${syllabus.credits || 0}`, 15, 72);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Academic Details:', pageWidth / 2, 62);
  doc.setFont('helvetica', 'normal');
  doc.text(`Category: ${syllabus.creditCategory || 'N/A'}`, pageWidth / 2, 67);
  doc.text(`Semester: ${syllabus.semester || 'N/A'}`, pageWidth / 2, 72);

  doc.setDrawColor(230);
  doc.line(15, 77, pageWidth - 15, 77);

  // Units Section
  doc.setFontSize(13);
  doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Course Content & Outcomes', 15, 85);

  const unitRows = (syllabus.units || []).map((unit, idx) => [
    `Unit ${idx + 1}\n${unit.title || 'Untitled'}`,
    unit.content || 'Content not defined.',
    unit.courseOutcome || 'N/A'
  ]);

  autoTable(doc, {
    startY: 90,
    head: [['Unit & Title', 'Topics', 'Course Outcome (CO)']],
    body: unitRows,
    theme: 'grid',
    headStyles: { 
      fillColor: [PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]], 
      fontSize: 10,
      halign: 'center'
    },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 35, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 45 }
    },
    margin: { left: 15, right: 15 }
  });

  // Resources Section
  let finalY = (doc as any).lastAutoTable.finalY + 12;
  
  if (finalY > 230) {
    doc.addPage();
    finalY = 20;
  }

  doc.setFontSize(13);
  doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Learning Resources', 15, finalY);
  finalY += 8;

  const drawResourceSection = (title: string, items?: string[]) => {
    if (!items || items.length === 0) return;
    doc.setFontSize(10);
    doc.setTextColor(ACCENT_COLOR[0], ACCENT_COLOR[1], ACCENT_COLOR[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 15, finalY);
    finalY += 5;
    
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    items.forEach(item => {
      const splitText = doc.splitTextToSize(`• ${item}`, pageWidth - 40);
      doc.text(splitText, 20, finalY);
      finalY += (splitText.length * 4.5);
      
      if (finalY > 275) {
        doc.addPage();
        finalY = 20;
      }
    });
    finalY += 4;
  };

  drawResourceSection('Recommended Text Books', syllabus.textBooks);
  drawResourceSection('Reference Materials', syllabus.referenceBooks);
  drawResourceSection('Digital Courses (NPTEL/SWAYAM)', syllabus.nptelLinks);
  drawResourceSection('Video Resources (YouTube)', syllabus.youtubeLinks);

  addFooter(doc);
  doc.save(`${syllabus.subjectCode || 'Subject'}_Detailed_Syllabus.pdf`);
};

/**
 * Generates and downloads a complete Course Structure PDF for an entire scheme.
 */
export const exportFullSchemeToPDF = (
  scheme: Scheme,
  program: Program,
  syllabi: Syllabus[]
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Institution Title
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text('RAJASTHAN TECHNICAL UNIVERSITY, KOTA', pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(18);
  doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Academia Flow | Course Structure', pageWidth / 2, 25, { align: 'center' });

  // Program & Branch Info
  doc.setFontSize(12);
  doc.setTextColor(50);
  doc.setFont('helvetica', 'bold');
  doc.text(`${program.name?.toUpperCase()}`, pageWidth / 2, 35, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Branch: ${scheme.branch || 'General'} | Batch: ${scheme.batchYear}`, pageWidth / 2, 41, { align: 'center' });
  doc.text(`Scheme Status: ${scheme.status} | Version: ${scheme.version}`, pageWidth / 2, 47, { align: 'center' });

  doc.setDrawColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.setLineWidth(0.5);
  doc.line(20, 53, pageWidth - 20, 53);

  // Credit Summary Section
  doc.setFontSize(14);
  doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('RTU-NEP 2020 Credit Distribution Summary', 20, 63);

  const categories = ['DSC', 'DSE', 'OFE', 'CPF', 'VAC', 'AEC', 'SEC', 'MDC'];
  const distribution = categories.map(cat => {
    const total = syllabi.filter(s => s.creditCategory === cat).reduce((acc, curr) => acc + (curr.credits || 0), 0);
    return [cat, total];
  });
  
  const grandTotal = syllabi.reduce((acc, curr) => acc + (curr.credits || 0), 0);
  distribution.push(['GRAND TOTAL', grandTotal]);

  autoTable(doc, {
    startY: 68,
    head: [['Category', 'Credits Acquired']],
    body: distribution,
    theme: 'striped',
    headStyles: { fillColor: PRIMARY_COLOR, halign: 'center' },
    bodyStyles: { halign: 'center', fontSize: 10 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 40, right: 40 }
  });

  let currentY = (doc as any).lastAutoTable.finalY + 15;

  // Semester-wise Course Structure
  for (let sem = 1; sem <= (program.totalSemesters || 8); sem++) {
    const semSubjects = syllabi.filter(s => s.semester === sem);
    const semCredits = semSubjects.reduce((acc, curr) => acc + (curr.credits || 0), 0);

    // Page check before each semester
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(13);
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`SEMESTER ${sem}`, 20, currentY);
    doc.setFontSize(10);
    doc.setTextColor(ACCENT_COLOR[0], ACCENT_COLOR[1], ACCENT_COLOR[2]);
    doc.text(`Total Semester Credits: ${semCredits}`, pageWidth - 20, currentY, { align: 'right' });
    
    const body = semSubjects.map(s => [
      s.subjectCode || '',
      s.title || '',
      `${s.lectureCredits || 0}-${s.tutorialCredits || 0}-${s.practicalCredits || 0}`,
      s.creditCategory || '',
      s.credits || 0
    ]);

    autoTable(doc, {
      startY: currentY + 4,
      head: [['Code', 'Course Title', 'L-T-P', 'Category', 'Cr']],
      body: body.length > 0 ? body : [['-', 'No courses added yet', '-', '-', '-']],
      theme: 'grid',
      headStyles: { fillColor: [100, 100, 100], fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      columnStyles: {
        0: { cellWidth: 25, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 15, halign: 'center', fontStyle: 'bold' }
      },
      margin: { left: 20, right: 20 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
  }

  addFooter(doc);
  doc.save(`${program.code}_${scheme.branch}_Structure.pdf`);
};

function addFooter(doc: jsPDF) {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.setDrawColor(200);
    doc.line(15, doc.internal.pageSize.getHeight() - 15, pageWidth - 15, doc.internal.pageSize.getHeight() - 15);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 35, doc.internal.pageSize.getHeight() - 10);
    doc.text(`Rajasthan Technical University | Academia Flow System | Official | ${new Date().toLocaleString()}`, 15, doc.internal.pageSize.getHeight() - 10);
  }
}
