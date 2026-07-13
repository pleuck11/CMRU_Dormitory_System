import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register Thai Font
Font.register({
  family: 'Kanit',
  fonts: [
    { src: '/fonts/Kanit-Regular.ttf' },
    { src: '/fonts/Kanit-Bold.ttf', fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Kanit',
    backgroundColor: '#ffffff',
  },
  headerBar: {
    height: 10,
    backgroundColor: '#8B5E3C', // A solid color approximation of the gradient
    marginBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 20,
    marginBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  printInfo: {
    alignItems: 'flex-end',
  },
  printLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  printDate: {
    fontSize: 12,
    fontWeight: 700,
    color: '#374151',
  },
  printTime: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1.5,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
  },
  statUnit: {
    fontSize: 10,
    fontWeight: 700,
    color: '#9CA3AF',
  },
  tableTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  tableTitleBar: {
    width: 4,
    height: 14,
    backgroundColor: '#8B5E3C',
    borderRadius: 2,
  },
  tableTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#1F2937',
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableColHeader: {
    padding: 8,
    fontSize: 10,
    fontWeight: 700,
    color: '#374151',
  },
  tableCol: {
    padding: 8,
    fontSize: 10,
    color: '#1F2937',
  },
  footer: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 10,
    color: '#9CA3AF',
  },
});

export interface ReportData {
  month: string;
  revenue: number;
  expenses: number;
  occupancyRate: number;
  newTenants: number;
}

interface ReportPDFProps {
  reportData: ReportData[];
}

export const ReportPDF: React.FC<ReportPDFProps> = ({ reportData }) => {
  const currentDate = new Date();
  const dateString = currentDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeString = currentDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';

  const stats = [
    { label: "รายรับเฉลี่ย", value: "0", unit: "บ./เดือน", color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" },
    { label: "ค่าใช้จ่ายเฉลี่ย", value: "0", unit: "บ./เดือน", color: "#991B1B", bg: "#FEF2F2", border: "#FECACA" },
    { label: "อัตราเข้าพักเฉลี่ย", value: "0", unit: "%", color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
    { label: "ผู้เช่าใหม่ปีนี้", value: "0", unit: "คน", color: "#1E40AF", bg: "#EFF6FF", border: "#BFDBFE" },
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar} />
        
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>รายงานสถิติและผลประกอบการ</Text>
            <Text style={styles.subtitle}>หอพักหยาหยี๋ (Yayee Dormitory)</Text>
          </View>
          <View style={styles.printInfo}>
            <Text style={styles.printLabel}>พิมพ์เมื่อ</Text>
            <Text style={styles.printDate}>{dateString}</Text>
            <Text style={styles.printTime}>{timeString}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((item, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: item.bg, borderColor: item.border }]}>
              <Text style={styles.statLabel}>{item.label}</Text>
              <View style={styles.statValueContainer}>
                <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
                <Text style={styles.statUnit}>{item.unit}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.tableTitleContainer}>
          <View style={styles.tableTitleBar} />
          <Text style={styles.tableTitle}>ข้อมูลรายเดือน ปี 2026</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={{ width: '20%' }}><Text style={[styles.tableColHeader, { textAlign: 'center' }]}>เดือน</Text></View>
            <View style={{ width: '25%' }}><Text style={[styles.tableColHeader, { textAlign: 'right' }]}>รายรับ (บาท)</Text></View>
            <View style={{ width: '25%' }}><Text style={[styles.tableColHeader, { textAlign: 'right' }]}>รายจ่าย (บาท)</Text></View>
            <View style={{ width: '15%' }}><Text style={[styles.tableColHeader, { textAlign: 'center' }]}>อัตราเข้าพัก (%)</Text></View>
            <View style={{ width: '15%' }}><Text style={[styles.tableColHeader, { textAlign: 'center' }]}>ผู้เช่าใหม่ (คน)</Text></View>
          </View>

          {reportData.length === 0 ? (
            <View style={[styles.tableRow, { padding: 16 }]}>
              <Text style={{ width: '100%', textAlign: 'center', fontSize: 10, color: '#9CA3AF' }}>ไม่มีข้อมูลรายงาน</Text>
            </View>
          ) : (
            reportData.map((row, idx) => (
              <View key={idx} style={[styles.tableRow, { backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }]}>
                <View style={{ width: '20%' }}><Text style={[styles.tableCol, { textAlign: 'center', fontWeight: 700 }]}>{row.month}</Text></View>
                <View style={{ width: '25%' }}><Text style={[styles.tableCol, { textAlign: 'right', color: '#065F46', fontWeight: 700 }]}>{row.revenue.toLocaleString()}</Text></View>
                <View style={{ width: '25%' }}><Text style={[styles.tableCol, { textAlign: 'right', color: '#991B1B', fontWeight: 700 }]}>{row.expenses.toLocaleString()}</Text></View>
                <View style={{ width: '15%' }}><Text style={[styles.tableCol, { textAlign: 'center' }]}>{row.occupancyRate}%</Text></View>
                <View style={{ width: '15%' }}><Text style={[styles.tableCol, { textAlign: 'center', fontWeight: 700 }]}>{row.newTenants}</Text></View>
              </View>
            ))
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Yayee Dormitory Management System</Text>
          <Text style={styles.footerText}>เอกสารนี้สร้างโดยระบบอัตโนมัติ · ไม่ต้องลงนาม</Text>
        </View>
      </Page>
    </Document>
  );
};
