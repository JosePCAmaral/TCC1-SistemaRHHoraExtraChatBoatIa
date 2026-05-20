import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportsService } from '../../core/services/reports.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-meu-relatorio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './meu-relatorio.component.html',
})
export class MeuRelatorioComponent implements OnInit {
  report = signal<any>(null);
  loading = signal(false);
  error = signal('');
  exporting = signal(false);

  filters = {
    startDate: '',
    endDate: '',
  };

  constructor(
    private reportsService: ReportsService,
    public authService: AuthService,
  ) {}

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

    this.reportsService.getMyReport(this.filters.startDate, this.filters.endDate).subscribe({
      next: (data) => { this.report.set(data); this.loading.set(false); },
      error: () => { this.error.set('Erro ao buscar relatório'); this.loading.set(false); },
    });
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
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFillColor(30, 64, 175);
      doc.rect(0, 0, pageWidth, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('RHIANA', 14, 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Meu Relatório de Horas', 14, 20);
      doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 14, 20, { align: 'right' });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`${r.user.name}`, 14, 42);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Cargo: ${r.user.position ?? '-'} | Departamento: ${r.user.department ?? '-'}`, 14, 52);
      doc.text(`Período: ${this.formatDate(r.period.startDate)} a ${this.formatDate(r.period.endDate)}`, 14, 58);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo de Horas', 14, 70);

      autoTable(doc, {
        startY: 74,
        head: [['Tipo', 'Bruto', 'Comprometido', 'Disponível']],
        body: [
          ['Extras 50%', this.formatHours(r.summary.bruto.h50), '', this.formatHours(r.summary.disponivel.h50)],
          ['Extras 60%', this.formatHours(r.summary.bruto.h60), '', this.formatHours(r.summary.disponivel.h60)],
          ['Extras 100%', this.formatHours(r.summary.bruto.h100), '', this.formatHours(r.summary.disponivel.h100)],
          ['Total Horas', this.formatHours(r.summary.bruto.totalExtra), this.formatHours(r.summary.comprometido.horas), this.formatHours(r.summary.disponivel.totalExtra)],
          ['Adicional Noturno', this.formatCurrency(r.summary.bruto.financeiro.vNight), '', this.formatCurrency(r.summary.disponivel.financeiro.vNight)],
          ['TOTAL FINANCEIRO', this.formatCurrency(r.summary.bruto.financeiro.total), '- ' + this.formatCurrency(r.summary.comprometido.valor), this.formatCurrency(r.summary.disponivel.financeiro.total)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [30, 64, 175] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      });

      const afterSummary = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Solicitações', 14, afterSummary);

      autoTable(doc, {
        startY: afterSummary + 4,
        head: [['Tipo', 'Status', 'Referência', 'Horas', 'Valor Est.', 'Justificativa']],
        body: (r.requestsList ?? []).map((req: any) => [
          req.type === 'pagamento' ? 'Pagamento' : 'Compensação',
          req.status === 'aprovado' ? 'Aprovado' : req.status === 'rejeitado' ? 'Rejeitado' : 'Pendente',
          this.formatDate(req.referenceDate),
          `${req.hoursAmount}h`,
          req.estimatedValue ? this.formatCurrency(req.estimatedValue) : '-',
          req.justification ?? '-',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [30, 64, 175] },
        columnStyles: { 5: { cellWidth: 45 } },
      });

      const afterRequests = (doc as any).lastAutoTable.finalY + 10;
      autoTable(doc, {
        startY: afterRequests,
        head: [['Resumo de Solicitações', 'Valor']],
        body: [
          ['Total de horas compensadas', `${r.requests.totals?.totalHorasCompensadas ?? 0}h`],
          ['Total de horas pagas', `${r.requests.totals?.totalHorasPagas ?? 0}h`],
          ['Valor total pago', this.formatCurrency(r.requests.totals?.totalValorPago ?? 0)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [5, 150, 105] },
      });

      doc.save(`meu_relatorio_${this.filters.startDate}.pdf`);
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

      const resumoData = [
        ['RHIANA — Meu Relatório'],
        [],
        ['Colaborador', r.user.name],
        ['Cargo', r.user.position ?? '-'],
        ['Departamento', r.user.department ?? '-'],
        ['Período', `${this.formatDate(r.period.startDate)} a ${this.formatDate(r.period.endDate)}`],
        [],
        ['RESUMO DE HORAS'],
        ['Tipo', 'Bruto (h)', 'Comprometido (h)', 'Disponível (h)', 'Valor Disponível (R$)'],
        ['Extras 50%', r.summary.bruto.h50, '', r.summary.disponivel.h50, r.summary.disponivel.financeiro.v50],
        ['Extras 60%', r.summary.bruto.h60, '', r.summary.disponivel.h60, r.summary.disponivel.financeiro.v60],
        ['Extras 100%', r.summary.bruto.h100, '', r.summary.disponivel.h100, r.summary.disponivel.financeiro.v100],
        ['Adicional Noturno', r.summary.bruto.nightHours, '', r.summary.disponivel.nightHours, r.summary.disponivel.financeiro.vNight],
        ['TOTAL', r.summary.bruto.totalExtra, r.summary.comprometido.horas, r.summary.disponivel.totalExtra, r.summary.disponivel.financeiro.total],
        [],
        ['SOLICITAÇÕES'],
        ['Total', r.requests.total],
        ['Pendentes', r.requests.pending],
        ['Aprovadas', r.requests.approved],
        ['Rejeitadas', r.requests.rejected],
        [],
        ['Total horas compensadas', r.requests.totals?.totalHorasCompensadas ?? 0],
        ['Total horas pagas', r.requests.totals?.totalHorasPagas ?? 0],
        ['Valor total pago (R$)', r.requests.totals?.totalValorPago ?? 0],
      ];
      const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
      XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

      const solicitacoesHeader = ['Tipo', 'Status', 'Data Referência', 'Horas', 'Valor Estimado', 'Justificativa'];
      const solicitacoesRows = (r.requestsList ?? []).map((req: any) => [
        req.type === 'pagamento' ? 'Pagamento' : 'Compensação',
        req.status === 'aprovado' ? 'Aprovado' : req.status === 'rejeitado' ? 'Rejeitado' : 'Pendente',
        this.formatDate(req.referenceDate),
        req.hoursAmount,
        req.estimatedValue ?? '-',
        req.justification ?? '-',
      ]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([solicitacoesHeader, ...solicitacoesRows]), 'Solicitações');

      XLSX.writeFile(wb, `meu_relatorio_${this.filters.startDate}.xlsx`);
    } finally {
      this.exporting.set(false);
    }
  }

  formatDate(date: string): string {
    return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR');
  }

  formatTime(time: string): string {
    return time?.substring(0, 5) ?? '--:--';
  }

  formatHours(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h${m > 0 ? ` ${m}min` : ''}`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0);
  }

  getDayTypeLabel(dayType: string): string {
    switch (dayType) {
      case 'domingo': return 'Domingo';
      case 'feriado': return 'Feriado';
      case 'sabado': return 'Sábado';
      default: return 'Dia útil';
    }
  }

  getDayTypeBadge(dayType: string): string {
    switch (dayType) {
      case 'domingo': return 'bg-red-100 text-red-700';
      case 'feriado': return 'bg-orange-100 text-orange-700';
      case 'sabado': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  }

  getRequestStatusClass(status: string): string {
    switch (status) {
      case 'aprovado': return 'bg-green-100 text-green-700';
      case 'rejeitado': return 'bg-red-100 text-red-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  }

  getRequestStatusLabel(status: string): string {
    switch (status) {
      case 'aprovado': return '✅ Aprovado';
      case 'rejeitado': return '❌ Rejeitado';
      default: return '⏳ Pendente';
    }
  }
}
