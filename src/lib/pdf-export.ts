
'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Syllabus } from './types';

/**
 * Generates and downloads a professional PDF document for a syllabus.
 */
export const exportSyllabusToPDF = (
  syllabus: Partial<Syllabus>, 
  programName: string = 'N/A', 
  branch: string = 'General', 
  batchYear: string = 'N/A'
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Color Palette (matching app theme)
  const primaryColor = [77, 26, 140]; // #4D1A8C
  const accentColor = [61, 143, 255]; // #3D8FFF

  // Header - Institution Title
  doc.setFontSize(18);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Academia Flow | Academic Management', pageWidth / 2, 15, { align: 'center' });
  
  // Scheme Info Header
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text(`${programName} (${branch})`, pageWidth / 2, 22, { align: 'center' });
  doc.text(`Batch: ${batchYear} | Version: Draft`, pageWidth / 2, 27, { align: 'center' });

  // Subject Branding Strip
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(15, 32, pageWidth - 30, 10, 'F');
  doc.setTextColor(255);
  doc.setFontSize(11);
  doc.text(`SUBJECT SYLLABUS: ${syllabus.subjectCode || 'CODE'} - ${syllabus.title?.toUpperCase() || 'TITLE'}`, 20, 38.5);

  // Basic Info Grid
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Credit Distribution:', 15, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(`L-T-P: ${syllabus.lectureCredits || 0}-${syllabus.tutorialCredits || 0}-${syllabus.practicalCredits || 0}`, 15, 57);
  doc.text(`Total Credits: ${syllabus.credits || 0}`, 15, 62);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Academic Details:', pageWidth / 2, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(`Category: ${syllabus.creditCategory || 'N/A'}`, pageWidth / 2, 57);
  doc.text(`Semester: ${syllabus.semester || 'N/A'}`, pageWidth / 2, 62);

  doc.setDrawColor(230);
  doc.line(15, 67, pageWidth - 15, 67);

  // Units Section
  doc.setFontSize(13);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Course Content & Outcomes', 15, 75);

  const unitRows = (syllabus.units || []).map((unit, idx) => [
    `Unit ${idx + 1}\n${unit.title || 'Untitled'}`,
    unit.content || 'Content not defined.',
    unit.courseOutcome || 'N/A'
  ]);

  autoTable(doc, {
    startY: 80,
    head: [['Unit & Title', 'Topics', 'Course Outcome (CO)']],
    body: unitRows,
    theme: 'grid',
    headStyles: { 
      fillColor: [primaryColor[0], primaryColor[1], primaryColor[2]], 
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
  
  // Page check for resources
  if (finalY > 230) {
    doc.addPage();
    finalY = 20;
  }

  doc.setFontSize(13);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Learning Resources', 15, finalY);
  finalY += 8;

  const drawResourceSection = (title: string, items?: string[]) => {
    if (!items || items.length === 0) return;
    doc.setFontSize(10);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 15, finalY);
    finalY += 5;
    
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    items.forEach(item => {
      // Handle text wrapping for long resource citations/links
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

  // Footer - Page Numbering & Generation Info
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.setDrawColor(200);
    doc.line(15, doc.internal.pageSize.getHeight() - 15, pageWidth - 15, doc.internal.pageSize.getHeight() - 15);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 35, doc.internal.pageSize.getHeight() - 10);
    doc.text(`Generated automatically by Academia Flow Academic System | ${new Date().toLocaleString()}`, 15, doc.internal.pageSize.getHeight() - 10);
  }

  doc.save(`${syllabus.subjectCode || 'Subject'}_Detailed_Syllabus.pdf`);
};
