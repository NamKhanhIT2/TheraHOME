import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const CYAN = '#00D9FF';
const WHITE_BLUE = '#BDEEFF';

// The spiralling particle field (owner-supplied canvas source, animated-loading
// .js/.css/.html, 2026-09-09). React Native has no <canvas>, and this project
// ships neither Skia nor a GL binding, so it runs in a transparent WebView —
// react-native-webview is already a dependency. The additive blend
// (`globalCompositeOperation = 'lighter'`) is what gives the trails their glow;
// the body is transparent so the screen's own dark backdrop shows through, and
// the canvas is sized to the WebView so it fills whatever box we give it.
const PARTICLE_HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>html,body{margin:0;width:100%;height:100%;background:transparent;overflow:hidden}canvas{position:absolute;inset:0;margin:auto}</style>
</head><body><canvas></canvas><script>
class Particle{constructor(o){this.x=o.x;this.y=o.y;this.angle=o.angle;this.speed=o.speed;this.accel=o.accel;this.radius=7;this.decay=0.01;this.life=1}
step(i){this.speed+=this.accel;this.x+=Math.cos(this.angle)*this.speed;this.y+=Math.sin(this.angle)*this.speed;this.angle+=PI/64;this.accel*=1.01;this.life-=this.decay;if(this.life<=0)particles.splice(i,1)}
draw(i){ctx.fillStyle='hsla('+(tick+this.life*120)+',100%,60%,'+this.life+')';ctx.strokeStyle=ctx.fillStyle;ctx.beginPath();if(particles[i-1]){ctx.moveTo(this.x,this.y);ctx.lineTo(particles[i-1].x,particles[i-1].y)}ctx.stroke();ctx.beginPath();ctx.arc(this.x,this.y,Math.max(0.001,this.life*this.radius),0,TAU);ctx.fill();var s=Math.random()*1.25;ctx.fillRect(~~(this.x+(Math.random()-0.5)*35*this.life),~~(this.y+(Math.random()-0.5)*35*this.life),s,s)}}
const PI=Math.PI,TAU=PI*2;const canvas=document.querySelector('canvas');const ctx=canvas.getContext('2d');const dpr=window.devicePixelRatio||1;
const side=Math.min(window.innerWidth,window.innerHeight);const width=side,height=side,min=width*0.5;const particles=[];let globalAngle=0,tick=0,now=0,frameDiff=0,lastFrame=0;
canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.scale(dpr,dpr);ctx.globalCompositeOperation='lighter';
function step(){particles.push(new Particle({x:width/2+Math.cos(tick/20)*min/2,y:height/2+Math.sin(tick/20)*min/2,angle:globalAngle,speed:0,accel:0.01}));particles.forEach((p,i)=>p.step(i));globalAngle+=PI/3}
function draw(){ctx.clearRect(0,0,width,height);particles.forEach((p,i)=>p.draw(i))}
function loop(){requestAnimationFrame(loop);now=Date.now();frameDiff=now-lastFrame;if(frameDiff>=1000/60){lastFrame=now;step();draw();tick++}}
loop();
</script></body></html>`;

type AnalyzingHudProps = {
  size?: number;
  preparingLabel: string;
  completedLabel: string;
  onComplete: () => void;
};

export function AnalyzingHud({ size = 400, preparingLabel, completedLabel, onComplete }: AnalyzingHudProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [completed, setCompleted] = useState(false);

  // One UI-thread value drives the number so its count stays smooth and the
  // completion callback fires exactly when it lands on 100 — the same easing
  // shape the previous HUD used: a quick start, a slower middle, a careful
  // 91→99, a visible pause at 99, then the final tick to 100.
  const progress = useSharedValue(0);
  const entrance = useSharedValue(0);
  // Hold the number at 0 until the particle canvas is actually up, so it
  // doesn't count against a blank ring during the WebView's load (owner report
  // 2026-09-09: "số chạy 1 tí rồi mới thấy hiệu ứng vòng"). onLoadEnd flips it;
  // a fallback timer covers the rare case that event is missed, and Reduce
  // Motion (no WebView) is ready immediately.
  const [particlesReady, setParticlesReady] = useState(reduceMotion);

  useEffect(() => {
    if (reduceMotion) return;
    const fallback = setTimeout(() => setParticlesReady(true), 1_100);
    return () => clearTimeout(fallback);
  }, [reduceMotion]);

  useEffect(() => {
    if (!particlesReady) return;
    entrance.value = withTiming(1, { duration: reduceMotion ? 120 : 420, easing: Easing.out(Easing.cubic) });
    // Small lead-in so a few particles have formed the arc before the count
    // starts moving, then the same easing shape as before.
    progress.value = withDelay(
      reduceMotion ? 0 : 240,
      withSequence(
        withTiming(45, { duration: 1_050, easing: Easing.out(Easing.cubic) }),
        withTiming(70, { duration: 1_800, easing: Easing.inOut(Easing.sin) }),
        withTiming(91, { duration: 820, easing: Easing.in(Easing.cubic) }),
        withTiming(99, { duration: 1_420, easing: Easing.out(Easing.cubic) }),
        withDelay(560, withTiming(99, { duration: 0 })),
        withTiming(100, { duration: 300, easing: Easing.out(Easing.cubic) }, (finished) => {
          if (finished) runOnJS(setCompleted)(true);
        }),
      ),
    );
    return () => {
      cancelAnimation(progress);
      cancelAnimation(entrance);
    };
    // Reanimated shared values are stable for this mounted HUD.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [particlesReady, reduceMotion]);

  useEffect(() => {
    if (!completed) return;
    const timer = setTimeout(onComplete, 1_050);
    return () => clearTimeout(timer);
  }, [completed, onComplete]);

  const percentProps = useAnimatedProps(() => {
    const value = Math.round(progress.value);
    return { text: `${value}%`, defaultValue: `${value}%` };
  });
  const numberStyle = useAnimatedStyle(() => {
    const enter = interpolate(entrance.value, [0, 1], [0.94, 1]);
    if (progress.value >= 99.95) return { opacity: entrance.value, transform: [{ scale: enter }, { translateY: 0 }] };
    const fraction = progress.value - Math.floor(progress.value);
    return {
      opacity: entrance.value * interpolate(fraction, [0, 0.16, 0.84, 1], [0.78, 1, 1, 0.82]),
      transform: [{ scale: enter }, { translateY: interpolate(fraction, [0, 0.5, 1], [1.2, 0, -1.2]) }],
    };
  });
  const captionStyle = useAnimatedStyle(() => ({ opacity: entrance.value }));

  const scale = size / 400;
  const subtitle = completed ? completedLabel : preparingLabel;

  return (
    <View style={styles.container}>
      {/* The ring: particle field with the count in its centre. */}
      <View style={{ width: size, height: size }}>
        {/* Particle field. Skipped under Reduce Motion — the number still
            counts, which is what actually drives the flow forward. */}
        {!reduceMotion ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <WebView
              source={{ html: PARTICLE_HTML }}
              style={styles.web}
              containerStyle={styles.web}
              originWhitelist={['*']}
              scrollEnabled={false}
              overScrollMode="never"
              opaque={false}
              androidLayerType="hardware"
              pointerEvents="none"
              javaScriptEnabled
              domStorageEnabled={false}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              onLoadEnd={() => setParticlesReady(true)}
            />
          </View>
        ) : null}

        <View style={styles.center} pointerEvents="none">
          <AnimatedTextInput
            defaultValue="0%"
            editable={false}
            caretHidden
            underlineColorAndroid="transparent"
            animatedProps={percentProps}
            style={[
              styles.percent,
              { width: 220 * scale, fontSize: 46 * scale, lineHeight: 58 * scale, fontFamily: theme.fontFamily.bold },
              numberStyle,
            ]}
            accessibilityLabel={subtitle}
          />
        </View>
      </View>

      {/* Label sits BELOW the ring, in the clear space, not inside it. */}
      <Animated.Text
        key={subtitle}
        numberOfLines={1}
        style={[
          styles.subtitle,
          {
            marginTop: -size * 0.08,
            fontSize: 15 * scale,
            letterSpacing: 1.4 * scale,
            fontFamily: theme.fontFamily.semiBold,
            color: completed ? WHITE_BLUE : '#7FD4FF',
          },
          captionStyle,
        ]}
      >
        {subtitle}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  web: { flex: 1, width: '100%', height: '100%', backgroundColor: 'transparent' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  percent: {
    color: '#EAFBFF',
    textAlign: 'center',
    padding: 0,
    margin: 0,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 14,
  },
  subtitle: {
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 8,
  },
});
