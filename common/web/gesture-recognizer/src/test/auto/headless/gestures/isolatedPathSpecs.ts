import { gestures } from '@keymanapp/gesture-recognizer';
import specs = gestures.specs;
import ContactModel = specs.ContactModel;

export const InstantRejectionModel: ContactModel = {
  itemPriority: 0,
  onPathResolve: 'reject',
  pathModel: {
    evaluate: (path) => 'resolve'
  }
}

export const InstantResolutionModel: ContactModel = {
  itemPriority: 0,
  onPathResolve: 'resolve',
  pathModel: {
    evaluate: (path) => 'resolve'
  }
}

export const MainLongpressSourceModel: ContactModel = {
  onItemChange: 'reject',
  itemPriority: 0,
  onPathResolve: 'resolve',
  timer: {
    duration: 500,
    expectedResult: true
  },
  pathModel: {
    evaluate: (path) => {
      const stats = path.stats;
      if(stats.rawDistance > 10) {
        return 'reject';
      }

      if(path.isComplete) {
        return 'reject';
      }
    }
  }
};

export const MainLongpressSourceModelWithShortcut: ContactModel = {
  ...MainLongpressSourceModel,
  pathModel: {
    evaluate: (path) => {
      const stats = path.stats;

      // Adds up-flick support!
      if(stats.rawDistance > 5 && stats.cardinalDirection == 'n') {
        return 'resolve';
      }

      return MainLongpressSourceModel.pathModel.evaluate(path);
    }
  }
}

export const SimpleTapModel: ContactModel = {
  itemPriority: 0,
  onItemChange: 'reject',
  onPathResolve: 'resolve',
  pathModel: {
    evaluate: (path) => {
      if(path.isComplete && !path.wasCancelled) {
        return 'resolve';
      }
    }
  }
}