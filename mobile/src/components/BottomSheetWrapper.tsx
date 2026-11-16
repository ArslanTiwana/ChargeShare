import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetProps,
} from '@gorhom/bottom-sheet';
import { colors, radii, spacing } from '../theme';

export interface BottomSheetWrapperProps extends Partial<BottomSheetProps> {
  children: React.ReactNode;
  snapPoints?: (string | number)[];
  onClose?: () => void;
}

export const BottomSheetWrapper = forwardRef<BottomSheet, BottomSheetWrapperProps>(
  ({ children, snapPoints: customSnapPoints, onClose, ...rest }, ref) => {
    const snapPoints = useMemo(
      () => customSnapPoints || ['45%', '85%'],
      [customSnapPoints]
    );

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={onClose}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            opacity={0.4}
          />
        )}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.indicator}
        {...rest}
      >
        <BottomSheetView style={styles.content}>{children}</BottomSheetView>
      </BottomSheet>
    );
  }
);

BottomSheetWrapper.displayName = 'BottomSheetWrapper';

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  indicator: {
    backgroundColor: colors.border,
    width: 40,
    height: 4,
  },
  content: {
    padding: spacing.xl,
    flex: 1,
  },
});
