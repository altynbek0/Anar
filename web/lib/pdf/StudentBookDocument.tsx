/* eslint-disable jsx-a11y/alt-text */
import {
  Document, Page, View, Text, Image, StyleSheet, Font, pdf,
} from '@react-pdf/renderer'
import type { BookData } from './types'

// ── Шрифт с кириллицей (PT Sans) ───────────────────────────────────────────────
Font.register({
  family: 'PTSans',
  fonts: [
    { src: '/fonts/PTSans-Regular.ttf', fontWeight: 'normal' },
    { src: '/fonts/PTSans-Bold.ttf', fontWeight: 'bold' },
  ],
})
// Отключаем перенос по слогам — для русского аккуратнее переносить по словам.
Font.registerHyphenationCallback((word) => [word])

// ── Палитра ─────────────────────────────────────────────────────────────────────
const NAVY = '#1E3A6E'
const BLUE = '#C93252'
const INK = '#1F2937'
const GRAY = '#6B7280'
const MUTED = '#9CA3AF'
const LINE = '#E5E7EB'
const SOFT = '#F3F6FC'

const CAT: Record<string, { label: string; color: string }> = {
  academic:   { label: 'Академическое', color: '#C93252' },
  behavior:   { label: 'Поведение',     color: '#CA8A04' },
  psychology: { label: 'Психология',    color: '#7C3AED' },
  sport:      { label: 'Спорт',         color: '#16A34A' },
  creative:   { label: 'Творчество',    color: '#EA580C' },
  health:     { label: 'Здоровье',      color: '#DC2626' },
  social:     { label: 'Социальное',    color: '#0D9488' },
}
const cat = (k: string) => CAT[k] ?? { label: k, color: GRAY }
const RISK: Record<string, string> = { none: 'Норма', medium: 'Средний риск', high: 'Высокий риск' }

const styles = StyleSheet.create({
  page: { fontFamily: 'PTSans', fontSize: 10, color: INK, paddingTop: 48, paddingBottom: 56, paddingHorizontal: 44, lineHeight: 1.45 },

  // header / footer
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: LINE },
  brand: { fontSize: 13, fontWeight: 'bold', color: NAVY },
  brandDot: { color: BLUE },
  headerTitle: { fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: 1 },
  footer: { position: 'absolute', bottom: 26, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8 },
  footerText: { fontSize: 8, color: MUTED },

  // section
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: NAVY, marginBottom: 8 },
  block: { marginBottom: 18 },

  card: { backgroundColor: SOFT, borderRadius: 8, padding: 12, marginBottom: 10 },
  cardTitle: { fontSize: 10, fontWeight: 'bold', color: BLUE, marginBottom: 4 },
  cardBody: { fontSize: 10, color: INK },
  muted: { color: MUTED },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: LINE },
  rowLabel: { fontSize: 10, color: GRAY },
  rowValue: { fontSize: 10, color: INK, fontWeight: 'bold', maxWidth: '62%', textAlign: 'right' },

  twoCol: { flexDirection: 'row', gap: 16 },
  col: { flex: 1 },

  // ── Обложка / финальная страница (светлый минимализм) ──
  coverPage: { fontFamily: 'PTSans', backgroundColor: '#FFFFFF', paddingHorizontal: 50, paddingTop: 46, paddingBottom: 40, height: '100%', position: 'relative' },

  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  schoolChip: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 260 },
  schoolLogo: { width: 30, height: 30, borderRadius: 15, objectFit: 'cover' },
  schoolLogoPh: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E5E5E5' },
  schoolNameTop: { fontSize: 11, fontWeight: 'bold', color: INK },
  anarLogo: { width: 26, height: 26 },
  anarBrand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  anarBrandText: { fontSize: 15, fontWeight: 'bold', color: INK },
  deco: { position: 'absolute', top: 96, right: -46, width: 320, height: 364 },
  leftEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, backgroundColor: '#0B0B0D' },

  tagline: { fontSize: 12, color: '#4B5563', marginTop: 40 },
  divider: { width: 120, height: 1, backgroundColor: '#111113', marginTop: 22 },

  bigTitle: { fontSize: 54, fontWeight: 'bold', color: '#0B0B0D', lineHeight: 1.02, letterSpacing: 1, marginTop: 46 },
  yearText: { fontSize: 13, fontWeight: 'bold', color: '#4B5563', marginTop: 14 },

  personRow: { flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 46 },
  personPhoto: { width: 96, height: 96, borderRadius: 48, objectFit: 'cover', borderWidth: 1, borderColor: LINE },
  personPhotoPh: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#E5E5E5', alignItems: 'center', justifyContent: 'center' },
  personInit: { fontSize: 30, fontWeight: 'bold', color: '#9CA3AF' },
  personName: { fontSize: 22, fontWeight: 'bold', color: '#0B0B0D' },
  personClass: { fontSize: 13, color: '#6B7280', marginTop: 3 },

  coverFoot: { marginTop: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  footLabel: { fontSize: 8, color: MUTED, textTransform: 'uppercase', letterSpacing: 1.2 },
  footDate: { fontSize: 9, color: MUTED },

  // финальная страница
  quoteMark: { fontSize: 72, fontWeight: 'bold', color: '#0B0B0D', lineHeight: 1, marginTop: 60 },
  quoteText: { fontSize: 26, fontWeight: 'bold', color: '#0B0B0D', lineHeight: 1.25, marginTop: 6 },
  thanks: { fontSize: 12, fontWeight: 'bold', color: '#111113' },
  thanksSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  // observations
  obs: { flexDirection: 'row', marginBottom: 12 },
  obsRail: { width: 3, borderRadius: 2, marginRight: 10 },
  obsBody: { flex: 1 },
  obsTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 3, gap: 6 },
  chip: { fontSize: 8, color: '#FFFFFF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  alertChip: { fontSize: 8, color: '#DC2626', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  obsDate: { fontSize: 9, color: MUTED },
  obsText: { fontSize: 10, color: INK },
  obsAuthor: { fontSize: 8, color: MUTED, marginTop: 2 },

  // bar chart
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  barLabel: { width: 110, fontSize: 9, color: GRAY },
  barTrack: { flex: 1, height: 10, backgroundColor: '#EEF2F7', borderRadius: 5 },
  barFill: { height: 10, borderRadius: 5 },
  barCount: { width: 22, fontSize: 9, color: INK, textAlign: 'right', fontWeight: 'bold' },
})

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// Декоративные ленты Anar — готовая картинка с мягкой тенью (react-pdf сам тень не умеет)
function DecoBars() {
  return <Image src="/pdf/deco-bars.png" style={styles.deco} />
}

function CoverHeader({ data }: { data: BookData }) {
  return (
    <View style={styles.brandRow}>
      <View style={styles.schoolChip}>
        {data.schoolLogoUrl ? <Image src={data.schoolLogoUrl} style={styles.schoolLogo} /> : <View style={styles.schoolLogoPh} />}
        <Text style={styles.schoolNameTop}>{data.schoolName || 'Название школы'}</Text>
      </View>
      <View style={styles.anarBrand}>
        <Image src="/pdf/anar-logo.png" style={styles.anarLogo} />
        <Text style={styles.anarBrandText}>Anar</Text>
      </View>
    </View>
  )
}

function Header({ title }: { title: string }) {
  return (
    <View style={styles.header} fixed>
      <Text style={styles.brand}>Anar</Text>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  )
}

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Anar · Платформа аналитики ученика</Text>
      <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

function SummaryCard({ title, text }: { title: string; text: string | null }) {
  return (
    <View style={styles.card} wrap={false}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={text ? styles.cardBody : [styles.cardBody, styles.muted]}>{text ?? 'Данных пока недостаточно.'}</Text>
    </View>
  )
}

export function StudentBookDocument({ data }: { data: BookData }) {
  const hasAnySummary = Object.values(data.summaries).some(Boolean)
  const maxCount = Math.max(1, ...data.categoryCounts.map(c => c.count))

  return (
    <Document title={`Книга ученика — ${data.fullName}`} author="Anar">
      {/* ── Обложка ── */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.leftEdge} fixed />
        <DecoBars />
        <CoverHeader data={data} />

        <Text style={styles.tagline}>Будущее начинается с понимания.</Text>
        <View style={styles.divider} />

        <Text style={styles.bigTitle}>КНИГА{'\n'}УЧЕНИКА</Text>
        <Text style={styles.yearText}>{data.schoolYear}–{data.schoolYear + 1} учебный год</Text>

        <View style={styles.personRow}>
          {data.photoUrl
            ? <Image style={styles.personPhoto} src={data.photoUrl} />
            : <View style={styles.personPhotoPh}><Text style={styles.personInit}>{initials(data.fullName)}</Text></View>}
          <View>
            <Text style={styles.personName}>{data.fullName}</Text>
            <Text style={styles.personClass}>{data.className} класс</Text>
          </View>
        </View>

        <View style={styles.coverFoot}>
          <Text style={styles.footLabel}>Профиль развития ученика</Text>
          <Text style={styles.footDate}>{data.generatedAt}</Text>
        </View>
      </Page>

      {/* ── Общий профиль ── */}
      <Page size="A4" style={styles.page}>
        <Header title="Общий профиль" />

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Личные данные</Text>
            <Field label="Класс" value={`${data.className}`} />
            <Field label="Год поступления" value={data.enrollmentYear ?? '—'} />
            <Field label="Статус" value={data.status === 'active' ? 'Активен' : 'Неактивен'} />
            <Field label="Уровень риска" value={RISK[data.riskLevel] ?? '—'} />
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Контакты родителей</Text>
            <Field label="ФИО родителя" value={data.parentName ?? '—'} />
            <Field label="Телефон" value={data.parentPhone ?? '—'} />
          </View>
        </View>

        <View style={[styles.block, { marginTop: 18 }]}>
          <Text style={styles.sectionTitle}>Цели и стремления</Text>
          <Field label="Цель ученика" value={data.goals.length ? data.goals.join('; ') : '—'} />
          <Field label="Мечта" value={data.dream ?? '—'} />
          <Field label="Цель родителя" value={data.parentGoal ?? '—'} />
        </View>

        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Семья и здоровье</Text>
          <Field label="Семейная обстановка" value={data.familySituation ?? '—'} />
          <Field label="Состояние здоровья" value={data.healthStatus ?? '—'} />
        </View>

        {data.summaries.overview && (
          <View style={styles.block}>
            <Text style={styles.sectionTitle}>Общая характеристика</Text>
            <View style={styles.card}>
              <Text style={styles.cardBody}>{data.summaries.overview}</Text>
            </View>
          </View>
        )}

        <Footer />
      </Page>

      {/* ── AI-профиль по разделам ── */}
      <Page size="A4" style={styles.page}>
        <Header title="Профиль по разделам" />
        <Text style={styles.sectionTitle}>Аналитические сводки</Text>
        {hasAnySummary ? (
          <>
            <SummaryCard title="Интересы и увлечения" text={data.summaries.interests} />
            <SummaryCard title="Успеваемость" text={data.summaries.academic} />
            <SummaryCard title="Внеурочная активность" text={data.summaries.extracurricular} />
            <SummaryCard title="Достижения" text={data.summaries.achievements} />
            <SummaryCard title="Психологический портрет" text={data.summaries.psychology} />
          </>
        ) : (
          <Text style={styles.muted}>Аналитические сводки ещё не сформированы.</Text>
        )}
        <Footer />
      </Page>

      {/* ── Наблюдения учителей ── */}
      <Page size="A4" style={styles.page}>
        <Header title="Наблюдения учителей" />

        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Сводка по категориям</Text>
          <Text style={{ fontSize: 9, color: GRAY, marginBottom: 8 }}>Всего наблюдений: {data.observationsTotal}</Text>
          {data.categoryCounts.length ? data.categoryCounts.map(c => (
            <View style={styles.barRow} key={c.category}>
              <Text style={styles.barLabel}>{cat(c.category).label}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(c.count / maxCount) * 100}%`, backgroundColor: cat(c.category).color }]} />
              </View>
              <Text style={styles.barCount}>{c.count}</Text>
            </View>
          )) : <Text style={styles.muted}>Наблюдений пока нет.</Text>}
        </View>

        {data.observations.length > 0 && (
          <View style={styles.block}>
            <Text style={styles.sectionTitle}>Хронология</Text>
            {data.observations.map((o, i) => (
              <View style={styles.obs} key={i} wrap={false}>
                <View style={[styles.obsRail, { backgroundColor: cat(o.category).color }]} />
                <View style={styles.obsBody}>
                  <View style={styles.obsTop}>
                    <Text style={styles.obsDate}>{o.date}</Text>
                    <Text style={[styles.chip, { backgroundColor: cat(o.category).color }]}>{cat(o.category).label}</Text>
                    {o.isAlert && <Text style={styles.alertChip}>Тревога</Text>}
                  </View>
                  <Text style={styles.obsText}>{o.content}</Text>
                  <Text style={styles.obsAuthor}>{o.author}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Footer />
      </Page>

      {/* ── Финальная страница ── */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.leftEdge} fixed />
        <DecoBars />
        <CoverHeader data={data} />

        <Text style={styles.quoteMark}>“</Text>
        <Text style={styles.quoteText}>Сегодня — профиль ученика.{'\n'}Завтра — история его успеха.</Text>
        <View style={[styles.divider, { marginTop: 26 }]} />

        <View style={styles.coverFoot}>
          <View>
            <Text style={styles.thanks}>Спасибо за доверие.</Text>
            <Text style={styles.thanksSub}>Вместе мы создаём будущее.</Text>
          </View>
          <Text style={styles.footDate}>{data.generatedAt}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateBookBlob(data: BookData): Promise<Blob> {
  return await pdf(<StudentBookDocument data={data} />).toBlob()
}
