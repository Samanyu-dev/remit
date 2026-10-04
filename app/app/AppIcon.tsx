// Shared artwork for the generated favicon/app icon and the iOS home-screen icon.
export function AppIcon({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 30% 20%, #3b6cf6 0%, #13224f 55%, #050814 100%)",
        color: "white",
        fontSize: size * 0.56,
        fontWeight: 700,
        letterSpacing: -size * 0.03,
      }}
    >
      r
    </div>
  );
}
