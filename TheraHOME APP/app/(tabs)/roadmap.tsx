import React, { Fragment } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { useActivatedPrograms, useCatalogProgramDays, useProducts } from '@/hooks/usePrograms';
import { useRequestDay } from '@/hooks/useRequestDay';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ProductDropdown } from '@/components/ProductDropdown';
import { PathNode } from '@/components/PathNode';
import { PainScaleModal } from '@/components/PainScaleModal';
import { useI18n } from '@/lib/i18n';
import { useAppStore } from '@/store/useAppStore';
import { useTabFocusFade } from '@/hooks/useTabFocusFade';
import { fadeUpEntering, staggerDelay } from '@/lib/motion';

export default function RoadmapScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { session } = useSession();
  const userId = session?.user.id;
  const selectedProductId = useAppStore((state) => state.selectedProductId);
  const selectProduct = useAppStore((state) => state.selectProduct);
  const { pendingDay, requestDay, confirmPain, cancelPain, isSubmitting } = useRequestDay();

  const productsQuery = useProducts();
  const programsQuery = useActivatedPrograms(userId);
  const activatedPrograms = programsQuery.data ?? [];
  const catalogProducts = productsQuery.data ?? [];
  const effectiveProductId = selectedProductId ?? activatedPrograms[0]?.productId ?? catalogProducts[0]?.id;
  const selectedProduct = catalogProducts.find((p) => p.id === effectiveProductId);
  const program = activatedPrograms.find((p) => p.productId === effectiveProductId);

  const daysQuery = useCatalogProgramDays(selectedProduct?.id, program?.userProgramId);
  const isLoading = productsQuery.isPending || programsQuery.isPending || (!!selectedProduct && daysQuery.isPending);
  const days = daysQuery.data ?? [];
  const focusFadeStyle = useTabFocusFade();

  let lastPhase: string | null = null;

  return (
    <ScreenContainer edges={['top']}>
      <Reanimated.View style={[{ flex: 1 }, focusFadeStyle]}>
      <ScrollView contentContainerStyle={styles.scrollBody}>
        <Reanimated.View entering={fadeUpEntering(0)} style={styles.header}>
          <Text style={[theme.type.display, { color: theme.colors.textPrimary }]}>{t('recoveryRoadmap')}</Text>
          <Text style={[theme.type.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>
            {t('chooseProduct')}
          </Text>
        </Reanimated.View>

        {selectedProduct ? (
          <Reanimated.View entering={fadeUpEntering(70)} style={{ marginTop: 12 }}>
            <ProductDropdown
              product={selectedProduct}
              products={catalogProducts}
              onSelect={selectProduct}
            />
          </Reanimated.View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : selectedProduct ? (
          <View style={{ marginTop: 8 }}>
            {days.map((d, index) => {
              const showPhase = d.phase !== lastPhase;
              lastPhase = d.phase;
              const itemDelay = 140 + staggerDelay(index, 20, 10);
              return (
                <Fragment key={d.id}>
                  {showPhase ? (
                    <Reanimated.View entering={fadeUpEntering(itemDelay)}>
                      <Text
                        style={[
                          theme.type.captionSm,
                          {
                            color: theme.colors.textSecondary,
                            textTransform: 'uppercase',
                            letterSpacing: 0.4,
                            paddingTop: 18,
                            paddingBottom: 8,
                          },
                        ]}
                      >
                        {d.phase}
                      </Text>
                    </Reanimated.View>
                  ) : null}
                  <Reanimated.View entering={fadeUpEntering(itemDelay)}>
                    <PathNode
                      day={d}
                      onPress={() => {
                        if (program) {
                          requestDay(d, program.userProgramId, program.productId);
                        } else {
                          requestDay(d, '', selectedProduct.id);
                        }
                      }}
                    />
                  </Reanimated.View>
                </Fragment>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
      </Reanimated.View>

      {pendingDay !== null ? (
        <PainScaleModal dayId={pendingDay} onCancel={cancelPain} onConfirm={confirmPain} submitting={isSubmitting} />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollBody: {
    paddingHorizontal: 20,
    paddingBottom: 140,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
});
