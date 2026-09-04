import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { type LegalDocKey } from '@/lib/legalContent';
import { useLegalDoc } from '@/hooks/useLegalDoc';

const SECTION_HEADER_RE = /^\d+(\.\d+)?\.\s/;

export interface LegalDocBodyProps {
  docKey: LegalDocKey;
}

/** Ported line-by-line from the reference `LegalDocBody` parser: line 0 is
 * the big title, line 1 a bold subtitle, line 2 a small muted line, line 3 a
 * disclaimer box, numbered lines (`1.`, `2.1.`, ...) are section headers,
 * tab-prefixed lines are bullets, everything else is a body paragraph. Empty
 * lines are skipped. */
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
        if (i === 3) {
          return (
            <View
              key={i}
              style={[styles.disclaimerBox, { backgroundColor: theme.colors.bgCardAlt, borderRadius: theme.radius.md }]}
            >
              <Text style={[styles.disclaimerText, { color: theme.colors.textSecondary }]}>{line}</Text>
            </View>
          );
        }
        if (SECTION_HEADER_RE.test(line)) {
          return (
            <Text key={i} style={[styles.sectionHeader, { color: theme.colors.textPrimary, fontFamily: theme.fontFamily.bold }]}>
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
