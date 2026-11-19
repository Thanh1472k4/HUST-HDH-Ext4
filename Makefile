all:
	@$(MAKE) -C BTL

clean:
	@$(MAKE) -C BTL clean

test:
	@$(MAKE) -C BTL test

.PHONY: all clean test
