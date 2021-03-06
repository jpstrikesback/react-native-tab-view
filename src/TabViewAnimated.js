/* @flow */

import * as React from 'react';
import PropTypes from 'prop-types';
import { Animated, Platform, View, StyleSheet, InteractionManager } from 'react-native';
import { NavigationStatePropType } from './TabViewPropTypes';
import type {
  Scene,
  SceneRendererProps,
  NavigationState,
  Layout,
  PagerProps,
  Style,
} from './TabViewTypeDefinitions';

type Props<T> = PagerProps<T> & {
  navigationState: NavigationState<T>,
  onIndexChange: (index: number) => void,
  tabChanged?: (index: number) => void,
  initialLayout?: Layout,
  renderPager: (props: *) => React.Element<any>,
  renderScene: (props: SceneRendererProps<T> & Scene<T>) => ?React.Element<any>,
  renderHeader?: (props: SceneRendererProps<T>) => ?React.Element<any>,
  renderFooter?: (props: SceneRendererProps<T>) => ?React.Element<any>,
  renderLeftSide?: (props: SceneRendererProps<T>) => ?React.Element<any>,
  renderRightSide?: (props: SceneRendererProps<T>) => ?React.Element<any>,
  useNativeDriver?: boolean,
  style?: Style,
};

type State = {|
  loaded: Array<number>,
  layout: Layout & { measured: boolean },
  layoutXY: Animated.ValueXY,
  panX: Animated.Value,
  offsetX: Animated.Value,
  position: any,
|};

let TabViewPager;

switch (Platform.OS) {
  case 'android':
    TabViewPager = require('./TabViewPagerAndroid').default;
    break;
  case 'ios':
    TabViewPager = require('./TabViewPagerScroll').default;
    break;
  default:
    TabViewPager = require('./TabViewPagerPan').default;
    break;
}

export default class TabViewAnimated<T: *> extends React.Component<
  Props<T>,
  State
> {
  static propTypes = {
    navigationState: NavigationStatePropType.isRequired,
    onIndexChange: PropTypes.func.isRequired,
    initialLayout: PropTypes.shape({
      height: PropTypes.number.isRequired,
      width: PropTypes.number.isRequired,
    }),
    canJumpToTab: PropTypes.func.isRequired,
    renderPager: PropTypes.func.isRequired,
    renderScene: PropTypes.func.isRequired,
    renderHeader: PropTypes.func,
    renderFooter: PropTypes.func,
    renderLeftSide: PropTypes.func,
    renderRightSide: PropTypes.func
  };

  static defaultProps = {
    canJumpToTab: () => true,
    renderPager: props => <TabViewPager {...props} />,
    initialLayout: {
      height: 0,
      width: 0,
    },
    useNativeDriver: false,
  };

  constructor(props: Props<T>) {
    super(props);

    const { navigationState } = this.props;
    const layout = {
      ...this.props.initialLayout,
      measured: false,
    };

    const panX = new Animated.Value(0);
    const offsetX = new Animated.Value(-navigationState.index * layout.width);
    const layoutXY = new Animated.ValueXY({
      // This is hacky, but we need to make sure that the value is never 0
      x: layout.width || 0.001,
      y: layout.height || 0.001,
    });
    const position = Animated.multiply(
      Animated.divide(Animated.add(panX, offsetX), layoutXY.x),
      -1
    );

    this.state = {
      loaded: [navigationState.index],
      layout,
      layoutXY,
      panX,
      offsetX,
      position,
    };
  }

  componentDidMount() {
    this._mounted = true;
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  _mounted: boolean = false;
  _nextIndex: ?number;

  _renderScene = (props: SceneRendererProps<T> & Scene<T>) => {
    return this.props.renderScene(props);
  };

  _handleLayout = (e: any) => {
    const { height, width } = e.nativeEvent.layout;

    if (
      this.state.layout.width === width &&
      this.state.layout.height === height
    ) {
      return;
    }

    this.state.offsetX.setValue(-this.props.navigationState.index * width);
    this.state.layoutXY.setValue({
      // This is hacky, but we need to make sure that the value is never 0
      x: width || 0.001,
      y: height || 0.001,
    });
    this.setState({
      layout: {
        measured: true,
        height,
        width,
      },
    });
  };

  _buildSceneRendererProps = (): SceneRendererProps<*> => ({
    panX: this.state.panX,
    offsetX: this.state.offsetX,
    position: this.state.position,
    layout: this.state.layout,
    navigationState: this.props.navigationState,
    jumpTo: this._jumpTo,
    useNativeDriver: this.props.useNativeDriver === true,
  });

  _jumpTo = (key: string) => {
    if (!this._mounted) {
      // We are no longer mounted, this is a no-op
      return;
    }

    const { canJumpToTab, navigationState } = this.props;
    const index = navigationState.routes.findIndex(route => route.key === key);

    if (!canJumpToTab(navigationState.routes[index])) {
      return;
    }

    if (index !== navigationState.index) {
      this.props.onIndexChange(index);
      InteractionManager.runAfterInteractions(() => {
        this.props.tabChanged && this.props.tabChanged(index);
      });
    }
  };

  render() {
    const {
      /* eslint-disable no-unused-vars */
      navigationState,
      onIndexChange,
      initialLayout,
      renderScene,
      /* eslint-enable no-unused-vars */
      renderPager,
      renderHeader,
      renderFooter,
      renderLeftSide,
      renderRightSide,
      ...rest
    } = this.props;

    const props = this._buildSceneRendererProps();

    return (
      <View
        onLayout={this._handleLayout}
        loaded={this.state.loaded}
        style={[styles.container, this.props.style]}
      >
        {renderHeader && renderHeader(props)}
        <View style={styles.content}>
          {renderLeftSide && renderLeftSide(props)}
          {renderPager({
            ...props,
            ...rest,
            panX: this.state.panX,
            offsetX: this.state.offsetX,
            children: navigationState.routes.map((route, index) => {
              const scene = this._renderScene({
                ...props,
                route,
                index,
                focused: index === navigationState.index,
              });

              if (scene) {
                return React.cloneElement(scene, { key: route.key });
              }

              return scene;
            }),
          })}
          {renderRightSide && renderRightSide(props)}
        </View>
        {renderFooter && renderFooter(props)}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    flex: 1
  }
});
