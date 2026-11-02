import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Image, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { homeGlassColors, useTheme } from '@/theme';
import { useI18n } from '@/lib/i18n';
import { Icon } from '@/components/icons/Icon';
import type { ChatMessageRow } from '@/hooks/useChat';

const COMPOSER_EMOJIS = ['😀', '😂', '🥰', '👍', '🙏', '❤️', '🎉', '💪'];

export interface ChatComposerHandle {
  focus: () => void;
  closeEmojis: () => void;
}

export interface ComposerAttachment {
  uri: string;
  kind: 'image' | 'video';
}

/**
 * The bar the user types in, on both chat threads.
 *
 * Three things it is built to get right.
 *
 * It is never disabled. The send button used to go dead for as long as a
 * reply was in flight — on the AI thread that is the whole round trip to
 * Claude, so the moment a person had the most to add was exactly when the
 * app stopped listening. Queueing (see useChatOutbox) means a second message
 * simply lines up behind the first, so nothing here has to be locked.
 *
 * The emoji row and the keyboard are mutually exclusive. They used to stack:
 * opening emoji pushed the whole conversation up by another row on top of
 * the keyboard. Opening one now dismisses the other, the way every messaging
 * app does it.
 *
 * The send button says what it will do. With something to send it is the
 * accent colour and a paper plane; with an empty composer it is visibly
 * inert — a muted thumbs-up on the specialist thread, where that sends a
 * quick like, and a plain disabled button on the AI thread, where an empty
 * message means nothing.
 */
export const ChatComposer = forwardRef<ChatComposerHandle, {
  value: string;
  onChangeValue: (value: string) => void;
  onSend: () => void;
  placeholder: string;
  /** What the button does with an empty composer. */
  emptyAction?: { kind: 'like'; onPress: () => void } | { kind: 'disabled' };
  attachment?: ComposerAttachment | null;
  onPickMedia?: () => void;
  onRemoveAttachment?: () => void;
  replyingTo?: ChatMessageRow | null;
  onCancelReply?: () => void;
  enableEmojis?: boolean;
  /** 'glass' for the customer's threads. The staff console stays light. */
  tone?: 'app' | 'glass';
}>(function ChatComposer(
  {
    value,
    onChangeValue,
    onSend,
    placeholder,
    emptyAction = { kind: 'disabled' },
    attachment,
    onPickMedia,
    onRemoveAttachment,
    replyingTo,
    onCancelReply,
    enableEmojis = true,
    tone = 'app',
  },
  ref,
) {
  const theme = useTheme();
  const glass = tone === 'glass';
  // The bar sits ON the thread, so it takes the screen's own ground rather
  // than `bgApp` — which on a dark thread was a white strip across the foot
  // of the screen.
  const ground = glass ? homeGlassColors.sky[4] : theme.colors.bgApp;
  const raised = glass ? homeGlassColors.surfaceRaised : theme.colors.bgCardAlt;
  const rule = glass ? homeGlassColors.hairline : theme.colors.divider;
  const ink = glass ? homeGlassColors.text : theme.colors.textPrimary;
  const inkMuted = glass ? homeGlassColors.textMuted : theme.colors.textSecondary;
  const inkFaint = glass ? homeGlassColors.textFaint : theme.colors.textMuted;
  const accent = glass ? homeGlassColors.tick : theme.colors.primary;
  const { t } = useI18n();
  const inputRef = useRef<TextInput>(null);
  const [showEmojis, setShowEmojis] = useState(false);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    closeEmojis: () => setShowEmojis(false),
  }));

  const hasContent = !!value.trim() || !!attachment;

  function toggleEmojis() {
    setShowEmojis((open) => {
      // Opening the row takes the keyboard's place rather than sitting on
      // top of it; closing it hands focus back so typing can continue.
      if (!open) Keyboard.dismiss();
      else inputRef.current?.focus();
      return !open;
    });
  }

  return (
    <>
      {replyingTo ? (
        <View style={[styles.context, { backgroundColor: raised, borderLeftColor: accent }]}>
          <View style={styles.flex}>
            <Text style={[styles.contextTitle, { color: accent }]}>{t('chatReplying')}</Text>
            <Text numberOfLines={1} style={{ color: inkMuted }}>{replyingTo.body || t('image')}</Text>
          </View>
          <Pressable onPress={onCancelReply} hitSlop={8}>
            <Icon name="x" size={18} color={inkFaint} />
          </Pressable>
        </View>
      ) : null}

      {showEmojis ? (
        <View style={[styles.emojiBar, { borderTopColor: rule }]}>
          {COMPOSER_EMOJIS.map((emoji) => (
            <Pressable key={emoji} onPress={() => onChangeValue(value + emoji)}>
              <Text style={styles.composerEmoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {attachment ? (
        <View style={[styles.attachmentTray, { borderTopColor: rule }]}>
          <View>
            {attachment.kind === 'video' ? (
              <View style={[styles.preview, styles.videoPreview]}>
                <Icon name="film" size={27} color="#fff" />
              </View>
            ) : (
              <Image source={{ uri: attachment.uri }} style={styles.preview} />
            )}
            <Pressable onPress={onRemoveAttachment} style={[styles.remove, { borderColor: ground }]} hitSlop={6}>
              <Icon name="x" size={12} color="#fff" />
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={[styles.inputRow, { borderTopColor: rule, backgroundColor: ground }]}>
        {onPickMedia ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('a11yPickMedia')}
            hitSlop={6}
            onPress={onPickMedia}
            style={styles.tool}
          >
            <Icon name="image" size={23} color={accent} />
          </Pressable>
        ) : null}

        {enableEmojis ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('a11yPickEmoji')}
            hitSlop={6}
            onPress={toggleEmojis}
            style={styles.tool}
          >
            <Icon name="smile" size={23} color={showEmojis ? accent : inkFaint} />
          </Pressable>
        ) : null}

        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeValue}
          onFocus={() => setShowEmojis(false)}
          multiline
          maxLength={2000}
          placeholder={placeholder}
          accessibilityLabel={t('a11yMessageInput')}
          placeholderTextColor={inkFaint}
          style={[styles.input, { borderColor: glass ? homeGlassColors.hairline : theme.colors.borderInput, color: ink, backgroundColor: raised }]}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !hasContent && emptyAction.kind === 'disabled' }}
          accessibilityLabel={hasContent ? t('a11ySend') : emptyAction.kind === 'like' ? t('a11ySendLike') : t('a11ySend')}
          disabled={!hasContent && emptyAction.kind === 'disabled'}
          onPress={() => (hasContent ? onSend() : emptyAction.kind === 'like' ? emptyAction.onPress() : undefined)}
          style={[
            styles.send,
            { backgroundColor: hasContent ? accent : raised },
          ]}
        >
          <Icon
            name={hasContent ? 'send' : emptyAction.kind === 'like' ? 'thumbs-up' : 'send'}
            size={18}
            color={hasContent ? '#fff' : inkFaint}
          />
        </Pressable>
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  context: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9, borderLeftWidth: 3 },
  contextTitle: { fontSize: 12, fontWeight: '700' },
  emojiBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  composerEmoji: { fontSize: 24 },
  attachmentTray: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  preview: { width: 76, height: 76, borderRadius: 12 },
  videoPreview: { backgroundColor: '#202838', alignItems: 'center', justifyContent: 'center' },
  remove: { position: 'absolute', right: -7, top: -7, width: 21, height: 21, borderRadius: 11, backgroundColor: '#E5484D', alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  tool: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minWidth: 0, maxHeight: 112, borderWidth: 1, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 14, fontSize: 15 },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
});
