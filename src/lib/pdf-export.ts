
'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Syllabus, Scheme, Program } from './types';

const PRIMARY_COLOR = [77, 26, 140]; // #4D1A8C
const ACCENT_COLOR = [61, 143, 255]; // #3D8FFF

/**
 * Helper to draw a single subject's syllabus into an existing jsPDF instance.
 * Returns the final Y position.
 */
const drawSubjectSyllabus = (
  doc: jsPDF, 
  syllabus: Partial<Syllabus>, 
  programName: string, 
  branch: string, 
  batchYear: string,
  startY: number,
  isDraft: boolean
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = startY;

  // Subject Branding Strip
  doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.rect(15, currentY, pageWidth - 30, 10, 'F');
  doc.setTextColor(255);
  doc.setFontSize(11);
  doc.text(`COURSE CODE: ${syllabus.subjectCode || 'CODE'} - ${syllabus.title?.toUpperCase() || 'TITLE'}`, 20, currentY + 6.5);
  currentY += 16;

  // Basic Info Grid
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Credit Distribution:', 15, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`L-T-P: ${syllabus.lectureCredits || 0}-${syllabus.tutorialCredits || 0}-${syllabus.practicalCredits || 0}`, 15, currentY + 5);
  doc.text(`Total Credits: ${syllabus.credits || 0}`, 15, currentY + 10);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Academic Details:', pageWidth / 2, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Category: ${syllabus.creditCategory || 'N/A'}`, pageWidth / 2, currentY + 5);
  doc.text(`Semester: ${syllabus.semester || 'N/A'}`, pageWidth / 2, currentY + 10);
  currentY += 18;

  // Units Section
  doc.setFontSize(12);
  doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Course Content & Outcomes', 15, currentY + 5);

  const unitRows = (syllabus.units || []).map((unit, idx) => [
    `Unit ${idx + 1}\n${unit.title || 'Untitled'}\n(${unit.hours} Hrs)`,
    unit.content || 'Content not defined.',
    unit.courseOutcome || 'N/A'
  ]);

  autoTable(doc, {
    startY: currentY + 10,
    head: [['Unit & Title', 'Topics', 'Course Outcome (CO)']],
    body: unitRows,
    theme: 'grid',
    headStyles: { 
      fillColor: [PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]], 
      fontSize: 9,
      halign: 'center'
    },
    bodyStyles: { fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: 35, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 45 }
    },
    margin: { left: 15, right: 15 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 12;

  // Resources Section
  const checkPage = (heightNeeded: number) => {
    if (currentY + heightNeeded > 275) {
      doc.addPage();
      currentY = 20;
      return true;
    }
    return false;
  };

  const drawResourceSection = (title: string, items?: string[]) => {
    if (!items || items.length === 0) return;
    checkPage(15);
    doc.setFontSize(10);
    doc.setTextColor(ACCENT_COLOR[0], ACCENT_COLOR[1], ACCENT_COLOR[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 15, currentY);
    currentY += 5;
    
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    items.forEach(item => {
      const splitText = doc.splitTextToSize(`• ${item}`, pageWidth - 40);
      checkPage(splitText.length * 5);
      doc.text(splitText, 20, currentY);
      currentY += (splitText.length * 4.5);
    });
    currentY += 4;
  };

  drawResourceSection('Recommended Text Books', syllabus.textBooks);
  drawResourceSection('Reference Materials', syllabus.referenceBooks);
  drawResourceSection('Digital Courses (NPTEL/SWAYAM)', syllabus.nptelLinks);
  drawResourceSection('Video Resources (YouTube)', syllabus.youtubeLinks);

  return currentY;
};

/**
 * Generates and downloads a professional PDF document for a single subject syllabus.
 */
export const exportSyllabusToPDF = (
  syllabus: Partial<Syllabus>, 
  programName: string = 'N/A', 
  branch: string = 'General', 
  batchYear: string = 'N/A',
  status: string = 'Approved'
) => {
  const doc = new jsPDF();
  const isDraft = status !== 'Approved';

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text('RAJASTHAN TECHNICAL UNIVERSITY, KOTA', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });

  drawSubjectSyllabus(doc, syllabus, programName, branch, batchYear, 25, isDraft);
  addFooter(doc, isDraft);
  doc.save(`${syllabus.subjectCode || 'Subject'}_Detailed_Syllabus.pdf`);
};

/**
 * Generates a complete Syllabus Book containing detailed info for ALL subjects in the scheme.
 */
export const exportCompleteSyllabusToPDF = (
  scheme: Scheme,
  program: Program,
  syllabi: Syllabus[]
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const isDraft = scheme.status !== 'Approved';

  // Title Page
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text('RAJASTHAN TECHNICAL UNIVERSITY, KOTA', pageWidth / 2, 80, { align: 'center' });
  
  doc.setFontSize(24);
  doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
  doc.text('COMPLETE SYLLABUS BOOK', pageWidth / 2, 100, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text(`${program.name?.toUpperCase()}`, pageWidth / 2, 115, { align: 'center' });
  doc.text(`Branch: ${scheme.branch || 'General'}`, pageWidth / 2, 125, { align: 'center' });
  doc.text(`Batch: ${scheme.batchYear}`, pageWidth / 2, 135, { align: 'center' });
  doc.text(`Framework: RTU-NEP 2020 Compliance`, pageWidth / 2, 145, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, 160, { align: 'center' });

  const sortedSyllabi = [...syllabi].sort((a, b) => {
    if (a.semester !== b.semester) return a.semester - b.semester;
    return a.subjectCode.localeCompare(b.subjectCode);
  });

  sortedSyllabi.forEach((syllabus) => {
    doc.addPage();
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text('RAJASTHAN TECHNICAL UNIVERSITY, KOTA', pageWidth / 2, 15, { align: 'center' });
    
    drawSubjectSyllabus(
      doc, 
      syllabus, 
      program.name, 
      scheme.branch || 'General', 
      scheme.batchYear, 
      25, 
      isDraft
    );
  });

  addFooter(doc, isDraft);
  doc.save(`${program.code}_${scheme.branch}_Complete_Syllabus.pdf`);
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
  const isDraft = scheme.status !== 'Approved';

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

  const categories = ['DSC', 'DSE', 'OFE', 'VAC', 'AEC', 'SEC', 'MDC', 'PRJ'];
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

  for (let sem = 1; sem <= (program.totalSemesters || 8); sem++) {
    const semSubjects = syllabi.filter(s => s.semester === sem && !s.isOFEContribution);
    const semCredits = semSubjects.reduce((acc, curr) => acc + (curr.credits || 0), 0);

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

  addFooter(doc, isDraft);
  doc.save(`${program.code}_${scheme.branch}_Structure.pdf`);
};

function addFooter(doc: jsPDF, isDraft: boolean = false) {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    if (isDraft) {
      doc.setFontSize(50);
      doc.setTextColor(230, 230, 230);
      doc.setFont('helvetica', 'bold');
      doc.text('DRAFT - FOR INTERNAL REVIEW', pageWidth / 2, pageHeight / 2, {
        align: 'center',
        angle: 45
      });
    }
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.setDrawColor(200);
    doc.line(15, doc.internal.pageSize.getHeight() - 15, pageWidth - 15, doc.internal.pageSize.getHeight() - 15);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 35, doc.internal.pageSize.getHeight() - 10);
    doc.text(`Rajasthan Technical University | Academia Flow System | Official | ${new Date().toLocaleString()}`, 15, doc.internal.pageSize.getHeight() - 10);
  }
}
