import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { type LegalDocKey } from '@/lib/legalContent';
import { useLegalDoc } from '@/hooks/useLegalDoc';

/** "1. " or "2.1 " — the trailing dot OR the sub-number is required, so a
 * paragraph that merely opens with a year ("2026 là ...") is not a heading.
 * The old pattern demanded a dot before the space, so every sub-heading in
 * the documents ("2.1 Dữ liệu bạn cung cấp trực tiếp") missed it and rendered
 * as ordinary body text (found while relaying these rules to the web,
 * 2026-09-21). Group 2 is the sub-number, i.e. the heading level. */
const SECTION_HEADER_RE = /^(\d+)\.(?:(\d+)\s|\s)/;

export interface LegalDocBodyProps {
  docKey: LegalDocKey;
}

/** Ported line-by-line from the reference `LegalDocBody` parser: line 0 is
 * the big title, line 1 a bold subtitle, line 2 a small muted line, line 3 a
 * disclaimer box UNLESS it is a heading, `1.`-style lines are section headers
 * and `2.1`-style lines sub-headers, tab-prefixed lines are bullets,
 * everything else is a body paragraph. Empty lines are skipped.
 *
 * The same grammar renders these documents on the web
 * (TheraHOME-WEB/src/components/LegalDocBody.tsx) — keep the two in step. */
export function LegalDocBody({ docKey }: LegalDocBodyProps) {
  const theme = useTheme();
  // Admin-published override when one exists, otherwise the bundled text.
  const doc = useLegalDoc(docKey);
  const lines = doc.text.split('\n');

  return (
    <View>
      {lines.map((raw, i) => {
        const line = raw.trim();
        if (!line) return null;

        const heading = SECTION_HEADER_RE.exec(line);

        if (i === 0) {
          return (
            <Text key={i} style={[theme.type.h1, { color: theme.colors.textPrimary, marginBottom: 4 }]}>
              {line}
            </Text>
          );
        }
        if (i === 1) {
          return (
            <Text key={i} style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              {line}
            </Text>
          );
        }
        if (i === 2) {
          return (
            <Text key={i} style={[styles.smallMuted, { color: theme.colors.textMuted }]}>
              {line}
            </Text>
          );
        }
        // Only when line 3 is NOT itself a heading: just the community
        // guidelines open with a standing note there, while terms, privacy
        // and security put "1. ..." on that line and had it boxed as if it
        // were a disclaimer.
        if (i === 3 && !heading) {
          return (
            <View
              key={i}
              style={[styles.disclaimerBox, { backgroundColor: theme.colors.bgCardAlt, borderRadius: theme.radius.md }]}
            >
              <Text style={[styles.disclaimerText, { color: theme.colors.textSecondary }]}>{line}</Text>
            </View>
          );
        }
        if (heading) {
          return (
            <Text
              key={i}
              style={[
                heading[2] ? styles.subSectionHeader : styles.sectionHeader,
                { color: theme.colors.textPrimary, fontFamily: theme.fontFamily.bold },
              ]}
            >
              {line}
            </Text>
          );
        }
        if (raw.startsWith('\t') || line.startsWith('•')) {
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.bulletDot, { color: theme.colors.textSecondary }]}>•</Text>
              <Text style={[styles.bulletText, { color: theme.colors.textSecondary }]}>{line.replace(/^•\s*/, '')}</Text>
            </View>
          );
        }
        return (
          <Text key={i} style={[styles.paragraph, { color: theme.colors.textSecondary }]}>
            {line}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  smallMuted: {
    fontSize: 12,
    marginBottom: 14,
  },
  disclaimerBox: {
    padding: 12,
    marginBottom: 18,
  },
  disclaimerText: {
    fontSize: 12,
    lineHeight: 19,
  },
  sectionHeader: {
    fontSize: 15,
    marginTop: 20,
    marginBottom: 6,
  },
  subSectionHeader: {
    fontSize: 13.5,
    marginTop: 14,
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
  },
  paragraph: {
    fontSize: 13.5,
    lineHeight: 21,
    marginBottom: 8,
  },
});
