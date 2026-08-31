import { Image, type ImageSourcePropType } from 'react-native';

// Keep onboarding artwork warm in the native image cache while the user is
// still reading the Welcome screen. The first question gets its own smaller
// batch so navigation never has to wait for illustrations from all 8 steps.
const FIRST_QUESTION_IMAGES: ImageSourcePropType[] = [
  require('../../assets/onboarding/goal-hero.png'),
  require('../../assets/onboarding/goal-sleep.png'),
  require('../../assets/onboarding/goal-work.png'),
  require('../../assets/onboarding/goal-spine.png'),
  require('../../assets/onboarding/goal-complete.png'),
];

const REMAINING_QUESTION_IMAGES: ImageSourcePropType[] = [
  require('../../assets/onboarding/priority-neck.png'),
  require('../../assets/onboarding/priority-back.png'),
  require('../../assets/onboarding/priority-full.png'),
  require('../../assets/onboarding/activity-hero.png'),
  require('../../assets/onboarding/activity-shoes.png'),
  require('../../assets/onboarding/activity-weights.png'),
  require('../../assets/onboarding/time-hero.png'),
  require('../../assets/onboarding/time-medium.png'),
  require('../../assets/onboarding/time-long.png'),
  require('../../assets/onboarding/tension-hero.png'),
  require('../../assets/onboarding/tension-poses-clean.png'),
  require('../../assets/onboarding/age-hero.png'),
  require('../../assets/onboarding/home-reason-sprite.png'),
  require('../../assets/onboarding/tension-timing-sprite.png'),
  require('../../assets/onboarding/tension-timing-hero.png'),
  require('../../assets/onboarding/priority-hero.png'),
];

let firstQuestionReady = false;
let firstQuestionPromise: Promise<void> | null = null;
let allQuestionsPromise: Promise<void> | null = null;

function preload(sources: ImageSourcePropType[]) {
  return Promise.all(
    sources.map((source) => {
      const uri = Image.resolveAssetSource(source)?.uri;
      return uri ? Image.prefetch(uri).catch(() => false) : Promise.resolve(false);
    }),
  ).then(() => undefined);
}

export function areFirstQuestionImagesReady() {
  return firstQuestionReady;
}

export function preloadFirstQuestionImages() {
  if (!firstQuestionPromise) {
    firstQuestionPromise = preload(FIRST_QUESTION_IMAGES).finally(() => {
      firstQuestionReady = true;
    });
  }
  return firstQuestionPromise;
}

export function preloadAllOnboardingImages() {
  if (!allQuestionsPromise) {
    allQuestionsPromise = Promise.all([
      preloadFirstQuestionImages(),
      preload(REMAINING_QUESTION_IMAGES),
    ]).then(() => undefined);
  }
  return allQuestionsPromise;
}
