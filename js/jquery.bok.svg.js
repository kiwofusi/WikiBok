/**
 * BokEditor描画用Javascript関数群
 *  - (d3.v2.jsの拡張ライブラリ)
 */
(function($){
	/**
	 * パラメータ2つから座標表現文字列へ変更
	 * @param x 横[省略:0]
	 * @param y 縦[省略:0]
	 */
	function _pos(x,y) {
		return (x || 0)+','+(y || 0);
	}
	/**
	 * 端数切捨て処理
	 * @param a 処理対象
	 * @param b 切捨て桁数(0で整数/1で小数点第1位/-1で十の位)
	 */
	function _floor(a,b) {
		var
			p = (arguments.length < 2 || b == undefined) ? 1 : Math.pow(10,b);
		return (Math.floor(a * p) / p)
	}
	/**
	 * 表示半径に内接する三角形(笆ｶ)となる座標文字列を作成
	 * @param r 半径
	 */
	function triangel(r,reps) {
		var
			x = _floor((r/Math.sqrt(3)  ),2),
			y = _floor((r/Math.sqrt(3)*2),2),
			_x = x * (-1),
			_y = y * (-1),
			hr = _floor((r/ 2),2),
			_hr= _floor((r/-2),2),
			mpos;
		mpos = (reps) ? [
			_pos(r,0),_pos(_x,_y),_pos(_x,_hr),
			_pos(r,0),_pos(_x, y),_pos(_x, hr),
			_pos(r,0)
		] : [
			_pos(_x,_y),_pos(r,0),_pos(_x,y)
		];
		return mpos.join(' ');
	}
	/**
	 * 表示半径に内接する四角形(■)となる座標文字列を作成
	 *  - 代表表現を持つ場合、形状を変更
	 * @param r 半径
	 */
	function rect(r,reps) {
		var
			l  = _floor((r/Math.sqrt(2)),2),
			_l = _floor((r/Math.sqrt(2)*(-1)),2),
			mpos;
		mpos = (reps) ? [
			_pos( 0, 0),_pos( 0, l),_pos( l, l),_pos( l, 0),
			_pos( 0, 0),_pos( 0,_l),_pos(_l,_l),_pos(_l, 0),
			_pos( 0, 0)
		] : [
			_pos(_l,_l),_pos( l,_l),_pos( l, l),_pos(_l, l),_pos(_l,_l)
		];
		return mpos.join(' ');
	}
	/**
	 * BOK-XMLからD3ライブラリで利用するデータ形式に変換
	 *   - XMLデータをthisとして渡すこと(callメソッドを利用)
	 */
	function convert() {
		var
			me = $(this),
			cs = [];
		//同一階層の子ノードをチェック
		$.each(me,function(i,o) {
			var
				n = $(o).find('>name').text(),
				c = $(o).find('>nodes'),
				cn = $(c).find('>node'),
				_cs = null;
			//子ノードを再帰(子ノード群として自身にデータを持つため)
			if(c.length > 0) {
				_cs = convert.call(cn);
			}
			//戻り値へ追加
			cs.push({
				name : n,
				children : _cs
			});
		});
		return cs;
	}
	/**
	 * データロード
	 */
	function load(xml) {
		var	root = convert.call($(xml));
		allData = root[0];
		//キャンパスサイズを再計算
		setSize();
		return update(allData)
	}
	/**
	 * 描画更新
	 */
	function update(source) {
		var
			diagonal = d3.svg
				.diagonal()
				.projection(function(d) {
					return [((d.y == undefined) ? 0 : d.y) , ((d.x == undefined) ? 0 : d.x)]
				}),
			//ノード
			nodes = tree.nodes(allData).reverse().filter(function(d){return (d.depth > 0);}),
			//リンク(エッジ)
			links = tree.links(nodes).filter(function(d) {return (d.source.depth > 0);}),
			node,
			link,
			add,
			tran;
		//深さで横位置を決定
		nodes.forEach(function(d) {
			d.y = (d.depth - 1) * options.w + d.depth * 5;
		});
		//各要素をObject化
		node = vis
			.selectAll('g.node')
			.data(nodes,function(d){return d.id || (d.id = ++i);}),
		link = vis
			.selectAll('path.link')
			.data(links,function(d){return d.target.id;}),
		add = node.enter()
			.append('svg:g')
			.attr('data',function(d) {return d.name})
			.attr('transform',function(d) {
				return 'translate('+_pos(source.y0,source.x0)+')';
			})
			.classed('node',true);

		//折り畳み用アイコンタグの追加
		add.append('svg:polygon')
			.attr('points',function(d){
				var
					r = d.r || 4.5,
					reps = options.reps(d);
				return (d.children ? rect(r,reps) : ((d._children) ? triangel(r,reps) : rect(r,reps)));
			})
			//クリックイベントを基本(折畳/展開)+追加(init設定にて変更可能)の2つ設定
			.on('click.add', options.polygonClick)
			.on('click.orig', function(d) {
				//トグル動菴・
				if (d.children) {
					d._children = d.children;
					d.children = null;
				}
				else {
					d.children = d._children;
					d._children = null;
				}
				//キャンパスサイズを再計算
				setSize();
				update(d);
			});
		//ノード名称タグの追加
		add.append('svg:text')
			.attr('x', 8)
			.attr('y', 3)
			.classed('name',true)
			.text(function(d) { return d.name; })
			.on('click.add', options.textClick)
			.on('click.orig', function(d){});
		//ノード名称タグの追加
		add.append('svg:text')
			.attr('x', 4)
			.attr('y',-3)
			.classed('childs',true);

		//ノード要素
		tran = node.classed(options.node.class,options.node.func).transition()
			.duration(options.duration)
			.attr('transform',function(d) {
				return 'translate('+_pos(d.y,d.x)+')';
			});
		//アイコンのみを限定選択
		tran.selectAll('polygon')
			.attr('points',function(d){
				var
					r = d.r || 4.5,
					reps = options.reps(d);
				return (d.children ? rect(r,reps) : ((d._children) ? triangel(r,reps) : rect(r,reps)));
			});
		//記事名称の書き換えを即時展開
		tran.selectAll('text.name')
			.text(function(d){return d.name;});
		tran.selectAll('text.childs')
			.text(function(d) {
				var
					ch = d.children || d._children || [];
				return ch.length; 
			});

		//ノードの消去時
		node.exit().transition()
			.duration(options.duration)
			.attr('transform',function(d) {return 'translate('+_pos(source.y,source.x)+')'})
			.style('opacity', 1e-6)
			.remove();
		//エッジ要素
		link.enter()
				.insert('svg:path','g')
				.classed('link',true)
				.attr('d',function(d) {
					var o = {x:(d.source.x0 || 0),y:(d.source.y0 || 0)};
					return diagonal({source: o , target : o});
				})
				//クリックイベントを基本(未設定)+追加(init設定にて変更可能)の2つ設定
				.on('click.add',options.pathClick)
				.on('click.orig',function(d){});
		link.transition()
				.duration(options.duration)
				.attr('d',function(d) {
						var s = {x:(d.source.x || 0),y:(d.source.y || 0)},
								t = {x:(d.target.x || 0),y:(d.target.y || 0)};
						return diagonal({source: s , target : t});
				});
		link.exit().transition()
				.duration(options.duration)
				.attr('d',function(d) {
						var o = {x:(d.source.x || 0),y:(d.source.y || 0)};
						return diagonal({source: o , target : o});
				})
				.remove();
		//再配置済みデータを旧配置データとして設定
		nodes.forEach(function(d) {
			d.x0 = d.x;
			d.y0 = d.y;
		});
		return true;
	}
	/**
	 * ノードを追加する
	 * @param a 追加するノードの名称
	 * @param b 追加するノードの親ノード名称
	 */
	function addNode(a,b) {
		var
			c = {name : a,children : null},
			pname = (arguments.length < 2) ? '' : b,
			//指定なし/見つからない場合=>疑似TOPに追加
			p = searchNode(pname) || allData || {
				name : '',
				children : null,
				_children : null,
			},
			//どちらもなかった場合、表示するように追加
			add = p._children || p.children || false;
		if(searchNode(a) !== false) {
			alert('もうある')
		}
		else {
			if(add == false) {
				p.children = [c];
			}
			else {
				add.push(c);
			}
			//キャンパスサイズを再計算
			setSize();
			update(p);
		}
		actNode(a);
	}
	/**
	 * ノードを移動する
	 * @param a 移動対象のノード名称
	 * @param b 移動先のノード名称
	 */
	function moveNode(a,b) {
		var
			c = searchNode(a),
			p = searchNode(b) || allData,
			add = p.children || p._children || [],
			//元ノードを削除するため...
			del = c.parent.children || c.parent._children || false;
		//移動先が一緒の場合、処理を省略...
		if(p == c.parent) {
		}
		else {
			add.push(c);
			del = $.map(del,function(d) {
				if(d !== c) {
					return d;
				}
			});
			c.parent.children = del;
			p.children = add;
		}
		update(p);
	}
	/**
	 * ノードを削除する
	 * @param a 対象ノード名称
	 * @para, b 対象ノード配下の子ノードの扱い[true:一緒に削除/false:上位ノードへ移動] 省略時は削除
	 */
	function delNode(a,b) {
		var
			c = searchNode(a),
			p = c.parent || false,
			cc = c.children || c._children || false,
			move = (arguments.length < 2 || b == undefined) ? true : !b,
			i;
			
		//自身の子ノードを上位ノードに移動する必要がある場合
		if(cc !== false && move !== false) {
			//子ノード毎に移動処理を実施
			i = cc.length;
			while(--i >= 0) {
				moveNode(cc[i].name,p.name);
			}
		}
		if(p.children == null) {
			p.children = p._children;
		}
		p.children = $.map(p.children,function(d) {
			if(d !== c) {
				return d;
			}
		});
		//キャンパスサイズを再計算
		setSize();
		update(p);
	}
	/**
	 * ノードの名前を変更する
	 * @param 変更前の名前
	 * @param 変更後の名前
	 */
	function renameNode(a,b) {
		var
			before = searchNode(a),
			after = $.map(allNode,function(d){if(d.name == b) return d});
		if(before !== false) {
			if(after.length < 1) {
				before.name = b;
				update(before);
				return true;
			}
		}
		return false;
	}
	/**
	 * キャンパスサイズを設定
	 * @param s (配列[幅,高])
	 */
	function setSize() {
		var
			n = tree.nodes(allData),
			//hc = allNode().length + 1,
			hc = n.length + 1,
			wc = Math.max.apply({},$.map(n,function(d){return [d.depth+1]})) || 1,
			s = $.map([hc * options.h , wc * options.w],Math.ceil),
			view;
		w = Math.max.apply({},[w,s[1]]) || w;
		view = '0 0 '+w+' '+s[0];
		tree.size([s[0],w]);
		svg.attr('width',w)
			.attr('height',s[0])
			.attr('viewBox',view);
	}
	/**
	 * 描画用キャンパスの初期設定
	 */
	function makeCanvas() {
		tree = d3.layout.tree();
		svg = d3.select(this.get(0)).append('svg:svg').attr('id','BokXml');
		vis = svg.append('svg:g')
			.attr('transform','translate(10,10)');
	}
	/**
	 * 対象ノードを検索
	 * @param a 対象ノード名称
	 */
	function searchNode(a,b) {
		var
			target = (arguments.length < 1 || a == '')
				? []
				: $.map(allNode(),function(d){
					var
						inp = a.replace(/\W/g,'\\$&'),
						reg = new RegExp((arguments.length < 2 || b == undefined || b == false) ? ('^'+inp+'$') : inp);
					if(d.name.match(reg)) {
						return d;
					}
				});
		return (target.length < 1) ? false : target[0];
	}
	/**
	 * 対象ノードを選択表示
	 * @param a 対象ノード名称
	 */
	function actNode(a,b) {
		var
			_class = (arguments.length < 2 || b == undefined) ? 'active' : b;
		return $.Deferred(function(def) {
			openTree(a);
			clearClassed(_class);
			classed(a,_class);
			def.resolve();
		})
		.promise();
	}
	/**
	 * 対象ノードまでを展開
	 * @param a 対象ノード名称
	 */
	function openTree(a) {
		var
			target = $.map(allNode(),function(d){
				if(d.name == a) {
					return d;
				}
			});
		//対象ノードまでを展開
		$.each(target,function() {
			var p = this.parent || false;
			if(p === false) {
				return;
			}
			else {
				//展開済み状態に変更
				if(p._children) {
					p.children = p._children;
					p._children = null;
					//キャンパスサイズを再計算
					setSize();
					update(p);
				}
				arguments.callee.call(p);
			}
		});;
	}
	/**
	 * 対象の[svg:g]ノードにCSS-Classを追加/削除する
	 * @param a 対象ノード名称
	 * @param b 設定CSS名称
	 * @param c true(追加)/false(削除)
	 */
	function classed(a,b,c) {
		var
			_id = (typeof a == 'string') ? a : a.name,
			target = 'g[data="'+_id+'"]',
			cls = (arguments.length < 2) ? 'active' : b,
			flg = (arguments.length < 3) ? true : c;
		//対象ノードのみ選択済み[active]クラスを追加
		d3.selectAll(target).classed(cls,flg);
	}
	/**
	 * 指定したクラスをすべてのノードから削除する
	 * @param cls  クラス名称
	 * @param node 対象ノード[省略時:g(ノード全体)]
	 */
	function clearClassed(cls,node) {
		var n = (arguments.length < 2) ? 'g' : node
		d3.selectAll(n).classed(cls,false);
	}
	function changeColor(a,b) {
	}
	/**
	 * 折り畳み済みのものも含めすべてのノードデータを取得
	 */
	function allNode() {
		var nodes = [];
		(function(c) {
			//子ノード[展開:children/折畳:_children]
			var child = this.children || this._children || false;
			if(this.name != '') {
				c.push(this);
			}
			//子ノードに対して再帰的に処理する
			if(child === false) {
				return;
			}
			else {
				for(var i=0;i<child.length;i++) {
					arguments.callee.call(child[i],c);
				}
			}
		}).call(allData,nodes);
		return nodes;
	}
	var
		i = 0,
		w = 0,
		tree,
		svg,
		vis,
		allData = null,
		options = {
			w : 180,
			h : 60,
			duration : 10,
			reps : function(d) {return false;},
			node : {
				class : '',
				func : function() {return false;}
			},
			polygonClick : function(){},
			pathClick : function() {},
			textClick : function() {},
		},
		BokEditor = {
			init : function(option) {
				options = $.extend({},options,option);
				makeCanvas.call(this);
				return BokEditor;
			},
			load : load,
			update : function(source) {
				if(arguments.length < 1) {
					update(allData);
				}
				else {
					update(source);
				}
			},
			addNode : addNode,
			actNode : actNode,
			allNode : allNode,
			delNode : delNode,
			moveNode: moveNode,
			renameNode : renameNode,
			classed : classed,
			clearClassed : clearClassed,
			marks_point : function(r) {
				return {
					reps_rect : rect(r,true),
					rect : rect(r),
					reps_triangel : triangel(r,true),
					triangel : triangel(r)
				};
			}
		};
	$.fn.extend({
		bok : BokEditor.init,
	});
})(jQuery);
