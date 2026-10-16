import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";

export type DropdownOption = { value: string; label: string; sublabel?: string };

type Props = {
  label: string;
  placeholder: string;
  options: DropdownOption[];
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** "sky" = white text on the Home sky background; "light" = dark text on light screens. */
  tone?: "sky" | "light";
};

/** Tap-to-open option list (bottom sheet), styled for the sky background on Home. */
export default function Dropdown({ label, placeholder, options, value, onChange, disabled, tone = "sky" }: Props) {
  const light = tone === "light";
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.field, light && styles.fieldLight, disabled && styles.disabled]}
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
      >
        <Text style={[styles.label, light && styles.dark]}>{label}</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.value, light && styles.dark, !selected && styles.placeholder]} numberOfLines={1}>
            {selected?.label ?? placeholder}
          </Text>
          <Text style={[styles.chevron, light && styles.dark]}>▾</Text>
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.option, item.value === value && styles.optionSelected]}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.optionText}>{item.label}</Text>
                  {item.sublabel ? <Text style={styles.optionSub}>{item.sublabel}</Text> : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  field: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  fieldLight: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2D4C3" },
  dark: { color: "#2B2320" },
  disabled: { opacity: 0.5 },
  label: { color: "#FFFFFF", fontSize: 11, fontWeight: "700", opacity: 0.85, letterSpacing: 0.5, textTransform: "uppercase" },
  valueRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  value: { color: "#FFFFFF", fontSize: 16, flex: 1 },
  placeholder: { opacity: 0.75 },
  chevron: { color: "#FFFFFF", fontSize: 14, marginLeft: 6 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "70%",
    paddingBottom: 24,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: "#22201E", padding: 16 },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5E5",
  },
  optionSelected: { backgroundColor: "#FDEBDD" },
  optionText: { fontSize: 16, color: "#22201E" },
  optionSub: { fontSize: 13, color: "#6E625A", marginTop: 2 },
});
