import AppKit

// Static design previews for the proposed foldable display sizes. The UI is
// redrawn from the current Home screen and uses its real hero photograph.
struct Canvas {
    static let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
    static let hero: NSImage = {
        let path = root.deletingLastPathComponent().appendingPathComponent("assets/home-hero.webp").path
        guard let image = NSImage(contentsOfFile: path) else { fatalError("Missing Home hero") }
        return image
    }()
    let width: Int
    let height: Int
    let rep: NSBitmapImageRep
    let context: NSGraphicsContext
    var W: CGFloat { CGFloat(width) }
    var H: CGFloat { CGFloat(height) }

    init(_ width: Int, _ height: Int) {
        self.width = width
        self.height = height
        guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
                                        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                                        isPlanar: false, colorSpaceName: .deviceRGB,
                                        bytesPerRow: 0, bitsPerPixel: 0),
              let context = NSGraphicsContext(bitmapImageRep: rep) else { fatalError("Bitmap creation failed") }
        self.rep = rep
        self.context = context
        NSGraphicsContext.current = context
        context.imageInterpolation = .high
    }

    func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> NSRect {
        NSRect(x: x, y: H - y - h, width: w, height: h)
    }

    func fill(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ color: NSColor, radius: CGFloat = 0) {
        color.setFill()
        NSBezierPath(roundedRect: rect(x, y, w, h), xRadius: radius, yRadius: radius).fill()
    }

    func stroke(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat,
                _ color: NSColor, radius: CGFloat, line: CGFloat = 2) {
        color.setStroke()
        let path = NSBezierPath(roundedRect: rect(x, y, w, h), xRadius: radius, yRadius: radius)
        path.lineWidth = line
        path.stroke()
    }

    func text(_ value: String, _ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat,
              size: CGFloat, weight: NSFont.Weight = .regular,
              color: NSColor = .white, align: NSTextAlignment = .left, tracking: CGFloat = 0) {
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = align
        paragraph.lineBreakMode = .byWordWrapping
        let font = NSFont.systemFont(ofSize: size, weight: weight)
        let attrs: [NSAttributedString.Key: Any] = [
            .font: font, .foregroundColor: color, .paragraphStyle: paragraph,
            .kern: tracking
        ]
        (value as NSString).draw(in: rect(x, y, w, h), withAttributes: attrs)
    }

    func circle(_ cx: CGFloat, _ cy: CGFloat, _ r: CGFloat, fill color: NSColor, stroke rim: NSColor? = nil, line: CGFloat = 2) {
        let path = NSBezierPath(ovalIn: rect(cx-r, cy-r, r*2, r*2))
        color.setFill(); path.fill()
        if let rim { rim.setStroke(); path.lineWidth = line; path.stroke() }
    }

    func line(_ x1: CGFloat, _ y1: CGFloat, _ x2: CGFloat, _ y2: CGFloat, color: NSColor, width: CGFloat) {
        let path = NSBezierPath()
        path.move(to: NSPoint(x: x1, y: H-y1))
        path.line(to: NSPoint(x: x2, y: H-y2))
        color.setStroke(); path.lineWidth = width; path.lineCapStyle = .round; path.stroke()
    }

    func photo(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, sourceYOffset: CGFloat = 0) {
        let source = Self.hero.size
        let targetRatio = w / h
        let sourceRatio = source.width / source.height
        var crop: NSRect
        if targetRatio > sourceRatio {
            let sourceH = source.width / targetRatio
            let originY = max(0, min(source.height-sourceH, (source.height-sourceH)/2 + sourceYOffset))
            crop = NSRect(x: 0, y: originY, width: source.width, height: sourceH)
        } else {
            let sourceW = source.height * targetRatio
            crop = NSRect(x: (source.width-sourceW)/2, y: 0, width: sourceW, height: source.height)
        }
        Self.hero.draw(in: rect(x, y, w, h), from: crop, operation: .sourceOver, fraction: 1)
    }

    func bottomScrim(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, maxAlpha: CGFloat = 0.94) {
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let alphas: [CGFloat] = [maxAlpha, maxAlpha*0.94, maxAlpha*0.72, 0.18, 0.05]
        let colors = alphas.map { NSColor(calibratedRed: 0.006, green: 0.035, blue: 0.075, alpha: $0).cgColor } as CFArray
        let stops: [CGFloat] = [0, 0.19, 0.43, 0.77, 1]
        guard let gradient = CGGradient(colorsSpace: colorSpace, colors: colors, locations: stops) else { return }
        let cg = context.cgContext
        cg.saveGState()
        cg.clip(to: rect(x, y, w, h))
        cg.drawLinearGradient(gradient,
                              start: CGPoint(x: x, y: H-y-h),
                              end: CGPoint(x: x, y: H-y), options: [])
        cg.restoreGState()
    }

    func symbol(_ name: String, _ x: CGFloat, _ y: CGFloat, _ side: CGFloat,
                color: NSColor, weight: NSFont.Weight = .regular) {
        guard let base = NSImage(systemSymbolName: name, accessibilityDescription: nil) else { return }
        let config = NSImage.SymbolConfiguration(pointSize: side*0.72, weight: weight)
        let image = base.withSymbolConfiguration(config) ?? base
        let tinted = NSImage(size: NSSize(width: side, height: side), flipped: false) { bounds in
            image.draw(in: bounds)
            if let cg = NSGraphicsContext.current?.cgContext {
                cg.setBlendMode(.sourceAtop)
                cg.setFillColor(color.cgColor)
                cg.fill(bounds)
            }
            return true
        }
        tinted.draw(in: rect(x, y, side, side))
    }

    func save(_ filename: String) {
        guard let data = rep.representation(using: .png, properties: [:]) else { fatalError("PNG export failed") }
        try! data.write(to: Self.root.appendingPathComponent(filename))
    }
}

let cyan = NSColor(calibratedRed: 0.29, green: 0.76, blue: 0.99, alpha: 1)
let navy = NSColor(calibratedRed: 0.035, green: 0.083, blue: 0.14, alpha: 1)
let whiteMuted = NSColor(calibratedWhite: 1, alpha: 0.76)
let rim = NSColor(calibratedWhite: 1, alpha: 0.35)

func status(_ c: Canvas, compact: Bool) {
    let y: CGFloat = compact ? 38 : 30
    let inset: CGFloat = compact ? 72 : 92
    c.text("22:08", inset, y, 220, 70, size: compact ? 45 : 49, weight: .semibold)
    let pillW: CGFloat = compact ? 236 : 260
    c.fill((c.W-pillW)/2, y-7, pillW, compact ? 72 : 76, .black, radius: 39)
    c.symbol("cellularbars", c.W-inset-250, y+4, 57, color: .white)
    c.symbol("wifi", c.W-inset-175, y+4, 57, color: .white)
    c.symbol("battery.100percent", c.W-inset-91, y+4, 69, color: .white)
}

func header(_ c: Canvas, y: CGFloat, compact: Bool) {
    let side: CGFloat = compact ? 84 : 110
    let diameter: CGFloat = compact ? 104 : 112
    c.circle(side+diameter/2, y+diameter/2, diameter/2, fill: NSColor(calibratedWhite: 0.96, alpha: 1), stroke: rim, line: 7)
    c.symbol("person", side+20, y+19, diameter-40,
             color: NSColor(calibratedWhite: 0.57, alpha: 1))
    c.text("THERANECK+", c.W/2-470, y+24, 940, 85, size: compact ? 59 : 66,
           weight: .light, align: .center, tracking: 9)
    c.circle(c.W-side-diameter/2, y+diameter/2, diameter/2, fill: NSColor(calibratedWhite: 1, alpha: 0.08), stroke: rim, line: 5)
    c.symbol("bell", c.W-side-diameter+29, y+27, diameter-58, color: .white)
    c.circle(c.W-side+2, y+12, 29, fill: NSColor(calibratedRed: 1, green: 0.37, blue: 0.4, alpha: 1))
    c.text("2", c.W-side-15, y-7, 35, 38, size: 34, weight: .semibold, align: .center)
}

func metrics(_ c: Canvas, x: CGFloat, y: CGFloat, width: CGFloat, compact: Bool) {
    let data = [("waveform.path.ecg", "3", "Mức đau"),
                ("square.stack.3d.up", "—", "Giai đoạn"),
                ("timer", "30p", "Luyện tập"),
                ("drop", "0/8", "Uống nước")]
    let cell = width/4
    let r: CGFloat = compact ? 78 : 88
    for (i, metric) in data.enumerated() {
        let cx = x + cell*(CGFloat(i)+0.5)
        c.circle(cx, y+r, r, fill: NSColor(calibratedWhite: 1, alpha: 0.055), stroke: rim, line: 5)
        c.symbol(metric.0, cx-28, y+26, 56, color: whiteMuted)
        c.text(metric.1, cx-r-10, y+69, 2*r+20, 80, size: compact ? 56 : 64, weight: .light, align: .center)
        c.text(metric.2, cx-cell/2, y+2*r+28, cell, 70, size: compact ? 35 : 39, color: whiteMuted, align: .center)
    }
}

func nav(_ c: Canvas, y: CGFloat, x: CGFloat, width: CGFloat, height: CGFloat) {
    c.fill(x, y, width-150, height, NSColor(calibratedRed: 0.07, green: 0.13, blue: 0.19, alpha: 0.96), radius: height/2)
    c.fill(x+24, y+16, (width-190)/4, height-32, NSColor(calibratedRed: 0.035, green: 0.10, blue: 0.16, alpha: 1), radius: (height-32)/2)
    let labels = ["house", "calendar", "cart", "person.2"]
    for i in 0..<4 {
        let center = x + (width-150)/4*(CGFloat(i)+0.5)
        c.symbol(labels[i], center-height*0.30, y+height*0.20, height*0.60,
                 color: i == 0 ? cyan : NSColor(calibratedRed: 0.49, green: 0.59, blue: 0.67, alpha: 1))
    }
    c.circle(x+width-65, y+height/2, height/2, fill: NSColor(calibratedRed: 0.07, green: 0.13, blue: 0.19, alpha: 0.97))
    c.symbol("bubble.left.and.bubble.right", x+width-height+30, y+height*0.26,
             height*0.48, color: cyan)
}

func makeOuter() {
    let c = Canvas(1398, 2034)
    c.photo(0, 0, c.W, c.H, sourceYOffset: 70)
    c.bottomScrim(0, 0, c.W, c.H)
    c.fill(0, 0, c.W, 250, NSColor(calibratedRed: 0.04, green: 0.13, blue: 0.23, alpha: 0.24))
    status(c, compact: true)
    header(c, y: 160, compact: true)
    metrics(c, x: 50, y: 300, width: c.W-100, compact: true)
    c.text("0", 255, 644, 80, 60, size: 35, color: whiteMuted, align: .center)
    c.text("14", c.W-330, 644, 110, 60, size: 35, color: whiteMuted, align: .center)
    c.text("Mở khoá lộ trình của bạn", 90, 1260, c.W-180, 100, size: 69, weight: .semibold, align: .center)
    c.text("Nhập số điện thoại hoặc email đã dùng khi đặt hàng\nđể xem lộ trình đầy đủ.",
           110, 1390, c.W-220, 160, size: 42, color: whiteMuted, align: .center)
    c.fill(312, 1590, c.W-624, 130, NSColor(calibratedWhite: 1, alpha: 0.23), radius: 66)
    c.stroke(312, 1590, c.W-624, 130, rim, radius: 66, line: 5)
    c.text("Nhập mã kích hoạt", 340, 1623, c.W-680, 83, size: 50, weight: .semibold, align: .center)
    nav(c, y: 1840, x: 45, width: c.W-90, height: 135)
    c.save("home-iphone-duo-outer-1398x2034.png")
}

func makeInner() {
    let c = Canvas(2670, 1878)
    c.fill(0, 0, c.W, c.H, navy)
    let leftW: CGFloat = 1480
    c.photo(0, 0, leftW, c.H, sourceYOffset: 170)
    c.bottomScrim(0, 0, leftW, c.H, maxAlpha: 0.84)
    // The inner display uses the extra width for the same Home content in two columns.
    c.fill(leftW, 0, c.W-leftW, c.H, NSColor(calibratedRed: 0.025, green: 0.065, blue: 0.11, alpha: 1))
    c.fill(leftW, 0, 2, c.H, NSColor(calibratedWhite: 1, alpha: 0.13))
    status(c, compact: false)
    header(c, y: 132, compact: false)
    metrics(c, x: 55, y: 320, width: leftW-110, compact: false)
    c.text("0", 260, 690, 90, 65, size: 42, color: whiteMuted, align: .center)
    c.text("14", leftW-330, 690, 105, 65, size: 42, color: whiteMuted, align: .center)
    c.text("TIẾN ĐỘ LỘ TRÌNH", 150, 1410, 760, 70, size: 42, weight: .medium, color: whiteMuted, tracking: 7)
    c.text("0 / 14 ngày", 150, 1495, 650, 130, size: 80, weight: .light)

    let rightX = leftW+110
    let rightW = c.W-leftW-220
    c.text("LỘ TRÌNH CỦA BẠN", rightX, 390, rightW, 65, size: 36, weight: .semibold, color: cyan, tracking: 7)
    c.text("Mở khoá lộ trình\ncủa bạn", rightX, 465, rightW, 250, size: 91, weight: .semibold)
    c.text("Nhập số điện thoại hoặc email đã dùng khi đặt hàng để xem lộ trình đầy đủ.",
           rightX, 770, rightW, 190, size: 49, color: whiteMuted)
    c.fill(rightX, 1010, rightW, 142, NSColor(calibratedWhite: 1, alpha: 0.15), radius: 70)
    c.stroke(rightX, 1010, rightW, 142, rim, radius: 70, line: 4)
    c.text("Nhập mã kích hoạt", rightX+38, 1041, rightW-76, 82, size: 55, weight: .semibold, align: .center)
    c.line(rightX, 1255, rightX+rightW, 1255, color: NSColor(calibratedWhite: 1, alpha: 0.19), width: 2)
    c.text("HÔM NAY", rightX, 1313, rightW, 62, size: 35, weight: .semibold, color: whiteMuted, tracking: 6)
    c.text("Mức đau  3", rightX, 1405, rightW/2, 85, size: 53, weight: .medium)
    c.text("Uống nước  0/8", rightX+rightW/2, 1405, rightW/2, 85, size: 53, weight: .medium)
    nav(c, y: 1696, x: 700, width: 1270, height: 132)
    c.save("home-iphone-duo-inner-open-2670x1878.png")
}

func makeComparison() {
    let c = Canvas(3200, 1600)
    c.fill(0, 0, c.W, c.H, NSColor(calibratedRed: 0.93, green: 0.95, blue: 0.97, alpha: 1))
    let ink = NSColor(calibratedRed: 0.08, green: 0.15, blue: 0.22, alpha: 1)
    c.text("TheraHOME trên iPhone Duo", 120, 65, c.W-240, 100,
           size: 70, weight: .semibold, color: ink, align: .center)
    c.text("Màn ngoài · 5,4 inch", 280, 210, 750, 65,
           size: 42, weight: .medium, color: ink, align: .center)
    c.text("Màn trong khi mở · 7,6 inch", 1280, 210, 1660, 65,
           size: 42, weight: .medium, color: ink, align: .center)

    func device(_ file: String, _ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, radius: CGFloat) {
        let bezel: CGFloat = 16
        let body = c.rect(x, y, w, h)
        let shadow = NSShadow()
        shadow.shadowColor = NSColor(calibratedWhite: 0, alpha: 0.20)
        shadow.shadowBlurRadius = 34
        shadow.shadowOffset = NSSize(width: 0, height: -13)
        NSGraphicsContext.saveGraphicsState()
        shadow.set()
        NSColor.black.setFill()
        NSBezierPath(roundedRect: body, xRadius: radius, yRadius: radius).fill()
        NSGraphicsContext.restoreGraphicsState()
        c.stroke(x, y, w, h, NSColor(calibratedWhite: 0.35, alpha: 1), radius: radius, line: 4)
        guard let image = NSImage(contentsOfFile: Canvas.root.appendingPathComponent(file).path) else { return }
        let screen = c.rect(x+bezel, y+bezel, w-2*bezel, h-2*bezel)
        NSGraphicsContext.saveGraphicsState()
        NSBezierPath(roundedRect: screen, xRadius: radius-bezel, yRadius: radius-bezel).addClip()
        image.draw(in: screen)
        NSGraphicsContext.restoreGraphicsState()
    }

    // The two bodies use the supplied 84.1 : 164.6 : 117.8 mm proportions.
    let bodyHeight: CGFloat = 1050
    let outerWidth = bodyHeight * 84.1 / 117.8
    let innerWidth = bodyHeight * 164.6 / 117.8
    device("home-iphone-duo-outer-1398x2034.png", 300, 315, outerWidth, bodyHeight, radius: 65)
    device("home-iphone-duo-inner-open-2670x1878.png", 1290, 315, innerWidth, bodyHeight, radius: 54)
    c.text("1398 × 2034 px", 300, 1410, outerWidth, 58, size: 39, color: ink, align: .center)
    c.text("2670 × 1878 px · xoay ngang", 1290, 1410, innerWidth, 58, size: 39, color: ink, align: .center)
    c.save("home-iphone-duo-side-by-side.png")
}

func makeScrolledHome() {
    let c = Canvas(1398, 2034)
    c.fill(0, 0, c.W, c.H, NSColor(calibratedRed: 0.035, green: 0.08, blue: 0.12, alpha: 1))
    c.fill(0, 0, c.W, 520, NSColor(calibratedRed: 0.055, green: 0.16, blue: 0.23, alpha: 1))
    c.bottomScrim(0, 0, c.W, 900, maxAlpha: 0.62)
    status(c, compact: true)
    header(c, y: 160, compact: true)

    let left: CGFloat = 96
    let contentW = c.W-2*left
    c.text("Nhẹ (0–3)", left, 335, 285, 62, size: 39, weight: .medium,
           color: NSColor(calibratedRed: 0.40, green: 0.76, blue: 0.96, alpha: 1))
    c.text("•", 376, 335, 35, 62, size: 40, color: whiteMuted)
    c.text("Vừa (4–7)", 418, 335, 310, 62, size: 39, weight: .medium,
           color: NSColor(calibratedRed: 0.66, green: 0.51, blue: 0.96, alpha: 1))
    c.text("•", 731, 335, 35, 62, size: 40, color: whiteMuted)
    c.text("Khó chịu (8–10)", 771, 335, 420, 62, size: 39, weight: .medium,
           color: NSColor(calibratedRed: 0.97, green: 0.35, blue: 0.53, alpha: 1))
    c.text("7 ngày⌄", c.W-270, 408, 180, 55, size: 36, color: .white, align: .right)

    let chartTop: CGFloat = 510
    let chartBottom: CGFloat = 895
    for score in stride(from: 10, through: 0, by: -2) {
        let yy = chartTop + CGFloat(10-score)/10*(chartBottom-chartTop)
        c.text(String(score), left, yy-18, 70, 52, size: 32, color: whiteMuted, align: .right)
        c.line(left+95, yy, c.W-left, yy,
               color: NSColor(calibratedWhite: 1, alpha: score == 0 ? 0.22 : 0.11), width: 2)
    }
    let pointX: CGFloat = 765
    let pointY = chartTop + CGFloat(7)/10*(chartBottom-chartTop)
    c.line(pointX, pointY+16, pointX, chartBottom,
           color: NSColor(calibratedRed: 0.35, green: 0.71, blue: 0.98, alpha: 0.65), width: 3)
    c.circle(pointX, pointY, 17,
             fill: NSColor(calibratedRed: 0.035, green: 0.08, blue: 0.12, alpha: 1),
             stroke: cyan, line: 6)
    c.text("3", pointX-52, pointY-95, 104, 60, size: 48, weight: .semibold, align: .center)
    c.text("N1", pointX-60, chartBottom+18, 120, 52, size: 34, color: whiteMuted, align: .center)

    c.line(left, 1010, c.W-left, 1010, color: NSColor(calibratedWhite: 1, alpha: 0.12), width: 2)
    c.symbol("drop.fill", left, 1050, 52, color: cyan)
    c.text("Uống nước", left+66, 1048, 560, 72, size: 57, weight: .semibold)
    c.text("Mục tiêu 8 cốc", c.W-500, 1058, 405, 58, size: 38, color: whiteMuted, align: .right)

    let dialX: CGFloat = c.W/2
    let dialY: CGFloat = 1355
    c.circle(dialX, dialY, 202, fill: NSColor(calibratedRed: 0.07, green: 0.11, blue: 0.16, alpha: 1),
             stroke: NSColor(calibratedWhite: 0.68, alpha: 0.8), line: 5)
    c.circle(dialX, dialY, 183, fill: NSColor(calibratedRed: 0.035, green: 0.06, blue: 0.09, alpha: 1),
             stroke: NSColor(calibratedRed: 0.035, green: 0.067, blue: 0.102, alpha: 1), line: 21)
    c.circle(dialX, dialY, 162, fill: NSColor(calibratedRed: 0.085, green: 0.11, blue: 0.14, alpha: 1))
    for i in 0..<48 {
        let angle = -CGFloat.pi/2 + CGFloat(i)*CGFloat.pi*2/48
        let inner: CGFloat = i % 4 == 0 ? 162 : 169
        let outer: CGFloat = 181
        c.line(dialX+cos(angle)*inner, dialY+sin(angle)*inner,
               dialX+cos(angle)*outer, dialY+sin(angle)*outer,
               color: NSColor(calibratedWhite: 1, alpha: i % 4 == 0 ? 0.65 : 0.34),
               width: i % 4 == 0 ? 3 : 2)
    }
    c.symbol("drop", dialX-26, dialY-120, 52, color: cyan)
    c.line(dialX, dialY+31, dialX, dialY-132,
           color: NSColor(calibratedRed: 0.96, green: 0.23, blue: 0.29, alpha: 1), width: 6)
    c.circle(dialX, dialY, 18, fill: NSColor(calibratedWhite: 0.13, alpha: 1),
             stroke: NSColor(calibratedWhite: 0.71, alpha: 1), line: 4)
    c.circle(296, dialY, 69, fill: NSColor(calibratedRed: 0.08, green: 0.10, blue: 0.13, alpha: 1),
             stroke: rim, line: 4)
    c.text("−", 245, dialY-40, 102, 85, size: 68, color: whiteMuted, align: .center)
    c.circle(c.W-296, dialY, 69, fill: NSColor(calibratedRed: 0.05, green: 0.28, blue: 0.47, alpha: 1),
             stroke: rim, line: 4)
    c.text("+", c.W-347, dialY-39, 102, 85, size: 67, align: .center)

    c.text("Còn 8 cốc để đạt mục tiêu", left, 1592, contentW, 75,
           size: 44, color: whiteMuted, align: .center)
    c.text("Nhắc tôi uống nước", left, 1690, 640, 66, size: 42, color: whiteMuted)
    c.fill(c.W-254, 1696, 155, 72, NSColor(calibratedWhite: 0.25, alpha: 1), radius: 37)
    c.circle(c.W-218, 1732, 30, fill: .white)
    nav(c, y: 1840, x: 45, width: c.W-90, height: 135)
    c.save("home-iphone-duo-scrolled-home-reference.png")
}

makeOuter()
makeInner()
makeComparison()
makeScrolledHome()
