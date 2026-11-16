import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { BookedSlot } from '../api/chargers';
import { colors, radii, spacing } from '../theme';

const TIMEZONE = 'Asia/Karachi';

export interface SlotPickerProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  selectedStartsAt: string | null; // ISO string
  selectedDurationHours: number;
  onSelectDuration: (hours: number) => void;
  onSelectSlot: (startsAtISO: string, endsAtISO: string) => void;
  bookedSlots: BookedSlot[];
  minDurationHours?: number;
  maxDurationHours?: number;
  isLoading?: boolean;
}

export function SlotPicker({
  selectedDate,
  onSelectDate,
  selectedStartsAt,
  selectedDurationHours,
  onSelectDuration,
  onSelectSlot,
  bookedSlots,
  minDurationHours = 1,
  maxDurationHours = 4,
  isLoading = false,
}: SlotPickerProps) {
  // 1. Generate next 7 days in Asia/Karachi
  const days = useMemo(() => {
    const list: Array<{ dateStr: string; dayName: string; dayNum: string }> = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getTime() + i * 24 * 3600 * 1000);
      const dateStr = formatInTimeZone(d, TIMEZONE, 'yyyy-MM-dd');
      const dayName = i === 0 ? 'Today' : formatInTimeZone(d, TIMEZONE, 'EEE');
      const dayNum = formatInTimeZone(d, TIMEZONE, 'd MMM');
      list.push({ dateStr, dayName, dayNum });
    }
    return list;
  }, []);

  // 2. Generate hourly time slots between 06:00 and 22:00
  const slots = useMemo(() => {
    const list: Array<{
      timeLabel: string;
      startsAtISO: string;
      endsAtISO: string;
      isAvailable: boolean;
      disabledReason?: string;
    }> = [];

    const nowTime = Date.now();
    const durationMs = selectedDurationHours * 3600 * 1000;

    for (let hour = 6; hour <= 22; hour++) {
      const hh = hour.toString().padStart(2, '0');
      const timeLabel = `${hh}:00`;
      const slotStart = fromZonedTime(`${selectedDate} ${timeLabel}:00`, TIMEZONE);
      const slotEnd = new Date(slotStart.getTime() + durationMs);

      const startsAtISO = slotStart.toISOString();
      const endsAtISO = slotEnd.toISOString();

      // Check if slot starts in the past (allow at least 15 min buffer from now)
      if (slotStart.getTime() <= nowTime + 15 * 60 * 1000) {
        list.push({
          timeLabel,
          startsAtISO,
          endsAtISO,
          isAvailable: false,
          disabledReason: 'Past',
        });
        continue;
      }

      // Check overlap with any active bookedSlot
      const hasOverlap = bookedSlots.some((b) => {
        const bStart = new Date(b.startsAt).getTime();
        const bEnd = new Date(b.endsAt).getTime();
        return slotStart.getTime() < bEnd && slotEnd.getTime() > bStart;
      });

      list.push({
        timeLabel,
        startsAtISO,
        endsAtISO,
        isAvailable: !hasOverlap,
        disabledReason: hasOverlap ? 'Occupied' : undefined,
      });
    }
    return list;
  }, [selectedDate, selectedDurationHours, bookedSlots]);

  // Duration options (e.g. 1h, 2h, 3h, 4h)
  const durations = useMemo(() => {
    const list: number[] = [];
    for (let h = minDurationHours; h <= maxDurationHours; h++) {
      list.push(h);
    }
    return list;
  }, [minDurationHours, maxDurationHours]);

  return (
    <View style={styles.container}>
      {/* Date Selector */}
      <Text style={styles.sectionTitle}>1. Select Date</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.daysScroll}
      >
        {days.map((item) => {
          const isSelected = item.dateStr === selectedDate;
          return (
            <TouchableOpacity
              key={item.dateStr}
              activeOpacity={0.7}
              onPress={() => onSelectDate(item.dateStr)}
              style={[styles.dayChip, isSelected && styles.dayChipSelected]}
              accessibilityRole="button"
              accessibilityLabel={`${item.dayName}, ${item.dayNum}`}
            >
              <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                {item.dayName}
              </Text>
              <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>
                {item.dayNum}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Duration Selector */}
      <Text style={styles.sectionTitle}>2. Select Duration</Text>
      <View style={styles.durationRow}>
        {durations.map((h) => {
          const isSelected = h === selectedDurationHours;
          return (
            <TouchableOpacity
              key={h}
              activeOpacity={0.7}
              onPress={() => onSelectDuration(h)}
              style={[styles.durationChip, isSelected && styles.durationChipSelected]}
              accessibilityRole="button"
              accessibilityLabel={`${h} hour duration`}
            >
              <Text style={[styles.durationText, isSelected && styles.durationTextSelected]}>
                {h} {h === 1 ? 'hour' : 'hours'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Slots Grid */}
      <Text style={styles.sectionTitle}>3. Select Start Time</Text>
      {isLoading ? (
        <Text style={styles.loadingText}>Checking charger availability...</Text>
      ) : (
        <View style={styles.slotsGrid}>
          {slots.map((slot) => {
            const isSelected = slot.startsAtISO === selectedStartsAt;
            return (
              <TouchableOpacity
                key={slot.timeLabel}
                disabled={!slot.isAvailable}
                activeOpacity={0.7}
                onPress={() => onSelectSlot(slot.startsAtISO, slot.endsAtISO)}
                style={[
                  styles.slotButton,
                  !slot.isAvailable && styles.slotDisabled,
                  isSelected && styles.slotSelected,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${slot.timeLabel}, ${slot.isAvailable ? 'available' : slot.disabledReason || 'unavailable'}`}
              >
                <Text
                  style={[
                    styles.slotText,
                    !slot.isAvailable && styles.slotTextDisabled,
                    isSelected && styles.slotTextSelected,
                  ]}
                >
                  {slot.timeLabel}
                </Text>
                {!slot.isAvailable && (
                  <Text style={styles.slotReason}>{slot.disabledReason}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  daysScroll: {
    paddingVertical: spacing.xs,
    gap: 8,
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    minWidth: 70,
    minHeight: 52,
    justifyContent: 'center',
  },
  dayChipSelected: {
    backgroundColor: colors.emeraldDark,
  },
  dayName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedText,
    marginBottom: 2,
  },
  dayNameSelected: {
    color: colors.white,
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  dayNumSelected: {
    color: colors.white,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: spacing.xs,
  },
  durationChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  durationChipSelected: {
    backgroundColor: colors.emeraldDark,
  },
  durationText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  durationTextSelected: {
    color: colors.white,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.xs,
  },
  slotButton: {
    width: '23%',
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  slotSelected: {
    borderColor: colors.emerald,
    backgroundColor: colors.emeraldLight,
  },
  slotDisabled: {
    backgroundColor: '#F8FAFC',
    opacity: 0.6,
  },
  slotText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  slotTextSelected: {
    color: colors.emeraldDark,
  },
  slotTextDisabled: {
    color: colors.subtleText,
    fontWeight: '500',
  },
  slotReason: {
    fontSize: 9,
    color: colors.subtleText,
    marginTop: 1,
  },
  loadingText: {
    fontSize: 13,
    color: colors.mutedText,
    paddingVertical: spacing.md,
    fontStyle: 'italic',
  },
});
