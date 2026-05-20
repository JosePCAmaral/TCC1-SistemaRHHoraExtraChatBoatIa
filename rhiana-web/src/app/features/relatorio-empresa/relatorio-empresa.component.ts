import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportsService } from '../../core/services/reports.service';

@Component({
  selector: 'app-relatorio-empresa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './relatorio-empresa.component.html',
})
export class RelatorioEmpresaComponent implements OnInit {
  report = signal<any>(null);
  loading = signal(false);
  error = signal('');
  exporting = signal(false);
  searchName = '';

  filters = {
    startDate: '',
    endDate: '',
  };

  constructor(private reportsService: ReportsService) {}

  ngOnInit() {
    const now = new Date();
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastDayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    this.filters.startDate = firstDay;
    this.filters.endDate = lastDayStr;
    this.search();
  }

  search() {
    if (!this.filters.startDate || !this.filters.endDate) { this.error.set('Selecione o período'); return; }
    this.error.set('');
    this.loading.set(true);
    this.report.set(null);

    this.reportsService.getCollectiveReport(this.filters.startDate, this.filters.endDate).subscribe({
      next: (data) => { this.report.set(data); this.loading.set(false); },
      error: () => { this.error.set('Erro ao buscar relatório'); this.loading.set(false); },
    });
  }

  get filteredCollaborators(): any[] {
    const list: any[] = this.report()?.collaborators ?? [];
    if (!this.searchName.trim()) return list;
    const q = this.searchName.toLowerCase();
    return list.filter(c => c.name.toLowerCase().includes(q) || (c.department ?? '').toLowerCase().includes(q));
  }

  async exportPDF() {
    const r = this.report();
    if (!r) return;
    this.exporting.set(true);

    try {
      const [{ default: jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const autoTable = autoTableModule.default;
      const doc = new jsPDF({ orientation: 'landscape' });
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, pageWidth, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('RHIANA', 14, 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Relatório da Empresa — Horas Extras por Colaborador', 14, 20);
      doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 14, 20, { align: 'right' });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${this.formatDate(r.period.startDate)} a ${this.formatDate(r.period.endDate)} | Colaboradores ativos: ${r.totalCollaborators}`, 14, 40);

      autoTable(doc, {
        startY: 46,
        head: [['Colaborador', 'Depto', 'Extra 50%', 'Extra 60%', 'Extra 100%', 'Noturnas', 'Total Extra', 'Valor Extra', 'Req.', 'H. Pagas', 'H. Comp.', 'Valor Pago']],
        body: r.collaborators.map((c: any) => [
          c.name,
          c.department ?? '-',
          this.formatHours(c.totalExtraHours50),
          this.formatHours(c.totalExtraHours60),
          this.formatHours(c.totalExtraHours100),
          this.formatHours(c.totalNightHours),
          this.formatHours(c.totalExtraHours),
          c.totalValueExtra != null ? this.formatCurrency(c.totalValueExtra) : '-',
          c.requests?.total ?? 0,
          this.formatHours(c.requests?.horasPagas ?? 0),
          this.formatHours(c.requests?.horasCompensadas ?? 0),
          c.requests?.valorPago != null ? this.formatCurrency(c.requests.valorPago) : '-',
        ]),
        foot: [[
          'TOTAL', '',
          this.formatHours(r.collaborators.reduce((s: number, c: any) => s + c.totalExtraHours50, 0)),
          this.formatHours(r.collaborators.reduce((s: number, c: any) => s + c.totalExtraHours60, 0)),
          this.formatHours(r.collaborators.reduce((s: number, c: any) => s + c.totalExtraHours100, 0)),
          this.formatHours(r.collaborators.reduce((s: number, c: any) => s + c.totalNightHours, 0)),
          this.formatHours(r.totalExtraHours),
          this.formatCurrency(r.totalExtraValue),
          r.totalRequerimentos ?? 0,
          this.formatHours(r.totalHorasPagas ?? 0),
          this.formatHours(r.totalHorasCompensadas ?? 0),
          this.formatCurrency(r.totalValorPago ?? 0),
        ]],
        theme: 'striped',
        headStyles: { fillColor: [30, 64, 175], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        footStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        columnStyles: { 7: { halign: 'right' }, 11: { halign: 'right' } },
      });

      doc.save(`relatorio_empresa_${this.filters.startDate}.pdf`);
    } finally {
      this.exporting.set(false);
    }
  }

  async exportExcel() {
    const r = this.report();
    if (!r) return;
    this.exporting.set(true);

    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const header = ['Colaborador', 'Departamento', 'Cargo', 'Dias Trab.', 'Normais (h)', 'Extra 50% (h)', 'Extra 60% (h)', 'Extra 100% (h)', 'Noturnas (h)', 'Total Extra (h)', 'Valor Extra (R$)', 'Req. Aprovados', 'H. Pagas', 'H. Compensadas', 'Valor Pago (R$)'];
      const rows = r.collaborators.map((c: any) => [
        c.name,
        c.department ?? '-',
        c.position ?? '-',
        c.workedDays,
        c.totalRegularHours,
        c.totalExtraHours50,
        c.totalExtraHours60,
        c.totalExtraHours100,
        c.totalNightHours,
        c.totalExtraHours,
        c.totalValueExtra ?? '',
        c.requests?.total ?? 0,
        c.requests?.horasPagas ?? 0,
        c.requests?.horasCompensadas ?? 0,
        c.requests?.valorPago ?? '',
      ]);

      const ws = XLSX.utils.aoa_to_sheet([
        ['RHIANA — Relatório da Empresa'],
        [`Período: ${this.formatDate(r.period.startDate)} a ${this.formatDate(r.period.endDate)}`],
        [`Colaboradores ativos: ${r.totalCollaborators}`],
        [],
        header,
        ...rows,
        [],
        ['TOTAIS', '', '', '',
          r.collaborators.reduce((s: number, c: any) => s + c.totalRegularHours, 0),
          r.collaborators.reduce((s: number, c: any) => s + c.totalExtraHours50, 0),
          r.collaborators.reduce((s: number, c: any) => s + c.totalExtraHours60, 0),
          r.collaborators.reduce((s: number, c: any) => s + c.totalExtraHours100, 0),
          r.collaborators.reduce((s: number, c: any) => s + c.totalNightHours, 0),
          r.totalExtraHours,
          r.totalExtraValue,
          r.totalRequerimentos ?? 0,
          r.totalHorasPagas ?? 0,
          r.totalHorasCompensadas ?? 0,
          r.totalValorPago ?? 0,
        ],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
      XLSX.writeFile(wb, `relatorio_empresa_${this.filters.startDate}.xlsx`);
    } finally {
      this.exporting.set(false);
    }
  }

  formatDate(date: string): string {
    return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR');
  }

  formatHours(hours: number): string {
    if (!hours) return '0h';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h${m > 0 ? ` ${m}min` : ''}`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0);
  }

  getExtraBarWidth(extra: number, maxExtra: number): string {
    if (!maxExtra) return '0%';
    return `${Math.min(100, (extra / maxExtra) * 100)}%`;
  }

  get maxExtraHours(): number {
    return Math.max(...(this.report()?.collaborators ?? []).map((c: any) => c.totalExtraHours), 0);
  }

  get filteredTotals() {
    const list = this.filteredCollaborators;
    return {
      workedDays: list.reduce((s, c) => s + (c.workedDays ?? 0), 0),
      extra50: list.reduce((s, c) => s + (c.totalExtraHours50 ?? 0), 0),
      extra60: list.reduce((s, c) => s + (c.totalExtraHours60 ?? 0), 0),
      extra100: list.reduce((s, c) => s + (c.totalExtraHours100 ?? 0), 0),
      night: list.reduce((s, c) => s + (c.totalNightHours ?? 0), 0),
      extra: list.reduce((s, c) => s + (c.totalExtraHours ?? 0), 0),
      value: list.reduce((s, c) => s + (c.totalValueExtra ?? 0), 0),
      requerimentos: list.reduce((s, c) => s + (c.requests?.total ?? 0), 0),
      horasPagas: list.reduce((s, c) => s + (c.requests?.horasPagas ?? 0), 0),
      horasCompensadas: list.reduce((s, c) => s + (c.requests?.horasCompensadas ?? 0), 0),
      valorPago: list.reduce((s, c) => s + (c.requests?.valorPago ?? 0), 0),
    };
  }
}
