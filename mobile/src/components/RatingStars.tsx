import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Button } from './Button';
import { colors, radii, spacing } from '../theme';

export interface RatingStarsProps {
  onSubmit: (rating: number, comment?: string) => void;
  isSubmitting?: boolean;
}

export function RatingStars({ onSubmit, isSubmitting = false }: RatingStarsProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    onSubmit(rating, comment.trim() || undefined);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rate your charging experience</Text>
      <Text style={styles.subtitle}>Help other EV drivers find great hosts.</Text>

      {/* Star Selector */}
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            activeOpacity={0.7}
            style={styles.starButton}
            accessibilityRole="button"
            accessibilityLabel={`${star} stars`}
          >
            <Text style={[styles.starIcon, star <= rating ? styles.starFilled : styles.starEmpty]}>
              ★
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.ratingText}>
        {rating === 5 && 'Outstanding!'}
        {rating === 4 && 'Very Good'}
        {rating === 3 && 'Average'}
        {rating === 2 && 'Below Expectation'}
        {rating === 1 && 'Poor'}
      </Text>

      {/* Comment Input */}
      <TextInput
        style={styles.commentInput}
        placeholder="Add an optional comment for the host..."
        placeholderTextColor={colors.subtleText}
        value={comment}
        onChangeText={setComment}
        multiline
        numberOfLines={3}
        maxLength={500}
      />

      <Button
        title="Submit Review"
        onPress={handleSubmit}
        loading={isSubmitting}
        style={styles.submitBtn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginVertical: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.mutedText,
    marginBottom: spacing.md,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  starButton: {
    padding: 6,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starIcon: {
    fontSize: 36,
  },
  starFilled: {
    color: '#F59E0B',
  },
  starEmpty: {
    color: '#D1D5DB',
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.mutedText,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  commentInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.ink,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
});
